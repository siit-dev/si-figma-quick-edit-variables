import { normalizeDiffValue, valuesEqual } from '../shared/diff'
import type {
  DiffLayerGroup,
  DiffScanPayload,
  InstanceDiff,
  VisualStyleProperty,
  VisualDifference,
} from '../shared/types'
import { visualPropertyAdapters } from './visual-diff/registry'
import type { VisualProperty } from './visual-diff/types'
import { VisualVariableResolver } from './visual-diff/variable-resolver'

type TreeNode = {
  id: string
  type: string
  name: string
  parent: BaseNode | null
  children?: readonly SceneNode[]
}

export async function scanInstanceDiff(rootIds?: string[]): Promise<DiffScanPayload> {
  const roots = await resolveRoots(rootIds)
  const instances = uniqueInstances(roots.flatMap(discoverInstances))
  const resolver = new VisualVariableResolver()
  const changed: InstanceDiff[] = []
  let unchangedInstanceCount = 0

  for (const instance of instances) {
    const result = await scanInstance(instance, roots, resolver)
    if (result.differenceCount > 0) changed.push(result)
    else unchangedInstanceCount += 1
  }

  return {
    roots: roots.map((node) => ({ id: node.id, name: node.name })),
    instances: changed,
    discoveredInstanceCount: instances.length,
    unchangedInstanceCount,
    scannedAt: Date.now(),
  }
}

async function scanInstance(
  instance: InstanceNode,
  roots: SceneNode[],
  resolver: VisualVariableResolver,
): Promise<InstanceDiff> {
  const main = await instance.getMainComponentAsync()
  const differences: VisualDifference[] = []

  if (main) {
    await compareMappedNodes(instance, instance, main, resolver, differences)
  } else {
    differences.push(
      structuralDifference(
        instance,
        instance,
        'Main component',
        'Component unavailable',
        'Instance',
      ),
    )
  }

  return {
    instanceId: instance.id,
    instanceName: instance.name,
    instancePath: pathFromSelectedRoot(roots, instance),
    mainComponentId: main?.id ?? null,
    mainComponentName: main?.name ?? 'Main component unavailable',
    mainComponentRemote: main?.remote ?? false,
    layers: await groupLayerDifferences(differences, resolver),
    differenceCount: differences.length,
  }
}

async function compareMappedNodes(
  instanceRoot: InstanceNode,
  current: SceneNode,
  original: SceneNode,
  resolver: VisualVariableResolver,
  differences: VisualDifference[],
): Promise<void> {
  if (current.type !== original.type && current.id !== instanceRoot.id) {
    differences.push(
      structuralDifference(
        instanceRoot,
        current,
        'Layer type',
        original.type,
        current.type,
      ),
    )
    return
  }

  if (current.visible !== original.visible) {
    differences.push({
      id: `${instanceRoot.id}|${current.id}|visible`,
      affectedNodeId: current.id,
      affectedNodeName: current.name,
      affectedNodeType: current.type,
      nodePath: pathWithin(instanceRoot, current),
      field: 'visible',
      label: 'Visibility',
      category: 'visibility',
      original: normalizeDiffValue(original.visible),
      current: normalizeDiffValue(current.visible),
    })
    return
  }
  if (!current.visible && !original.visible) return

  await compareVisualProperties(
    instanceRoot,
    current,
    original,
    resolver,
    differences,
  )

  if (current.id !== instanceRoot.id && current.type === 'INSTANCE') {
    if (original.type !== 'INSTANCE') return
    const [currentMain, originalMain] = await Promise.all([
      current.getMainComponentAsync(),
      original.getMainComponentAsync(),
    ])
    if (currentMain?.id !== originalMain?.id) {
      differences.push(
        structuralDifference(
          instanceRoot,
          current,
          'Nested component',
          originalMain?.name ?? 'Unavailable',
          currentMain?.name ?? 'Unavailable',
        ),
      )
    }
    return
  }

  const currentChildren = 'children' in current ? current.children : []
  const originalChildren = 'children' in original ? original.children : []
  const count = Math.max(currentChildren.length, originalChildren.length)
  for (let index = 0; index < count; index += 1) {
    const currentChild = currentChildren[index]
    const originalChild = originalChildren[index]
    if (currentChild && originalChild) {
      await compareMappedNodes(
        instanceRoot,
        currentChild,
        originalChild,
        resolver,
        differences,
      )
      continue
    }
    const unmatched = currentChild ?? originalChild
    if (!unmatched || !isEffectivelyVisible(unmatched)) continue
    differences.push(
      structuralDifference(
        instanceRoot,
        currentChild ?? current,
        currentChild ? 'Added visible layer' : 'Removed visible layer',
        currentChild ? 'Absent' : describeNode(originalChild),
        currentChild ? describeNode(currentChild) : 'Absent',
      ),
    )
  }
}

async function compareVisualProperties(
  instanceRoot: InstanceNode,
  current: SceneNode,
  original: SceneNode,
  resolver: VisualVariableResolver,
  differences: VisualDifference[],
) {
  for (const adapter of visualPropertyAdapters) {
    const currentProperties = new Map(
      safeExtract(adapter.extract, current).map((property) => [
        property.field,
        property,
      ]),
    )
    const originalProperties = new Map(
      safeExtract(adapter.extract, original).map((property) => [
        property.field,
        property,
      ]),
    )
    for (const [field, currentProperty] of currentProperties) {
      const originalProperty = originalProperties.get(field)
      // If a derived-value rule removes either side, the property is intentionally suppressed.
      if (!originalProperty || valuesEqual(originalProperty.value, currentProperty.value)) {
        continue
      }
      const [originalTokens, currentTokens] = await Promise.all([
        resolver.resolve(original, originalProperty.aliases),
        resolver.resolve(current, currentProperty.aliases),
      ])
      differences.push({
        id: `${instanceRoot.id}|${current.id}|${adapter.id}|${field}`,
        affectedNodeId: current.id,
        affectedNodeName: current.name,
        affectedNodeType: current.type,
        nodePath: pathWithin(instanceRoot, current),
        field,
        label: currentProperty.label,
        category: currentProperty.category,
        original: toDiffValue(originalProperty, originalTokens),
        current: toDiffValue(currentProperty, currentTokens),
      })
    }
  }
}

function toDiffValue(
  property: VisualProperty,
  tokens: Awaited<ReturnType<VisualVariableResolver['resolve']>>,
) {
  return normalizeDiffValue(property.value, {
    unit: property.unit,
    preview: property.preview,
    tokens,
  })
}

function safeExtract(
  extract: (node: SceneNode) => VisualProperty[],
  node: SceneNode,
): VisualProperty[] {
  try {
    return extract(node)
  } catch {
    return []
  }
}

function structuralDifference(
  instanceRoot: InstanceNode,
  affected: SceneNode,
  label: string,
  original: string,
  current: string,
): VisualDifference {
  return {
    id: `${instanceRoot.id}|${affected.id}|structure|${label}`,
    affectedNodeId: affected.id,
    affectedNodeName: affected.name,
    affectedNodeType: affected.type,
    nodePath: pathWithin(instanceRoot, affected),
    field: 'structure',
    label,
    category: 'structure',
    original: normalizeDiffValue(original),
    current: normalizeDiffValue(current),
  }
}

async function groupLayerDifferences(
  differences: VisualDifference[],
  resolver: VisualVariableResolver,
): Promise<DiffLayerGroup[]> {
  const groups = new Map<string, DiffLayerGroup>()
  for (const difference of differences) {
    const current = groups.get(difference.affectedNodeId) ?? {
      nodeId: difference.affectedNodeId,
      nodeName: difference.affectedNodeName,
      nodeType: difference.affectedNodeType,
      nodePath: difference.nodePath,
      differences: [],
      currentProperties: [],
    }
    current.differences.push(difference)
    groups.set(difference.affectedNodeId, current)
  }
  await Promise.all(
    [...groups.values()].map(async (group) => {
      const node = await getSceneNode(group.nodeId)
      if (node) group.currentProperties = await snapshotCurrentProperties(node, resolver)
    }),
  )
  return [...groups.values()]
}

async function snapshotCurrentProperties(
  node: SceneNode,
  resolver: VisualVariableResolver,
): Promise<VisualStyleProperty[]> {
  const properties: VisualStyleProperty[] = []
  for (const adapter of visualPropertyAdapters) {
    for (const property of safeExtract(adapter.extract, node)) {
      if (property.category === 'structure') continue
      properties.push({
        field: property.field,
        label: property.label,
        category: property.category,
        value: toDiffValue(property, await resolver.resolve(node, property.aliases)),
      })
    }
  }
  properties.push({
    field: 'visible',
    label: 'Visibility',
    category: 'visibility',
    value: normalizeDiffValue(node.visible),
  })
  return properties
}

async function resolveRoots(rootIds?: string[]): Promise<SceneNode[]> {
  if (!rootIds) return [...figma.currentPage.selection]
  const roots: SceneNode[] = []
  for (const id of rootIds) {
    const node = await getSceneNode(id)
    if (node) roots.push(node)
  }
  return roots
}

function discoverInstances(root: SceneNode): InstanceNode[] {
  const found: InstanceNode[] = []
  const visit = (node: SceneNode, isRoot = false) => {
    if (node.type === 'INSTANCE' && (isRoot || node.visible)) found.push(node)
    if (!node.visible) return
    if ('children' in node) {
      for (const child of node.children) visit(child)
    }
  }
  visit(root, true)
  return found
}

function uniqueInstances(instances: InstanceNode[]): InstanceNode[] {
  return [...new Map(instances.map((instance) => [instance.id, instance])).values()]
}

async function getSceneNode(id: string): Promise<SceneNode | null> {
  const node = await figma.getNodeByIdAsync(id)
  return node && node.type !== 'DOCUMENT' && node.type !== 'PAGE' ? node : null
}

export function structuralIndexPath(
  root: Pick<TreeNode, 'id'>,
  target: TreeNode,
): number[] | null {
  const path: number[] = []
  let current: TreeNode | null = target
  while (current && current.id !== root.id) {
    const parent = current.parent
    if (!parent || !('children' in parent)) return null
    const children = (parent as ChildrenMixin).children
    const index = children.findIndex((child) => child.id === current?.id)
    if (index < 0) return null
    path.unshift(index)
    current = parent as unknown as TreeNode
  }
  return current?.id === root.id ? path : null
}

export function nodeAtIndexPath(
  root: SceneNode,
  path: number[],
): SceneNode | null {
  let current: SceneNode = root
  for (const index of path) {
    if (!('children' in current)) return null
    const next = current.children[index]
    if (!next) return null
    current = next
  }
  return current
}

function pathWithin(root: SceneNode, node: SceneNode): string[] {
  if (root.id === node.id) return [root.name]
  const result = [node.name]
  let current = node.parent
  while (
    current &&
    current.id !== root.id &&
    current.type !== 'PAGE' &&
    current.type !== 'DOCUMENT'
  ) {
    result.unshift(current.name)
    current = current.parent
  }
  result.unshift(root.name)
  return result
}

function pathFromSelectedRoot(roots: SceneNode[], node: SceneNode): string[] {
  const root = roots.find((candidate) => isAncestorOrSelf(candidate, node))
  return root ? pathWithin(root, node) : [node.name]
}

function isAncestorOrSelf(ancestor: SceneNode, node: SceneNode): boolean {
  let current: BaseNode | null = node
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.id === ancestor.id) return true
    current = current.parent
  }
  return false
}

function isEffectivelyVisible(node: SceneNode): boolean {
  let current: BaseNode | null = node
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if ('visible' in current && !current.visible) return false
    current = current.parent
  }
  return true
}

function describeNode(node: SceneNode | undefined): string {
  return node ? `${node.name} (${node.type})` : 'Unavailable'
}
