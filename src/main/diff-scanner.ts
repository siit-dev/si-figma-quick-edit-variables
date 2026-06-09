import {
  categoryForField,
  friendlyFieldLabel,
  friendlyPropertyName,
  normalizeDiffValue,
  valuesEqual,
} from '../shared/diff'
import type {
  ComponentPropertyDifference,
  DiffLayerGroup,
  DiffScanPayload,
  InstanceDiff,
  LayerFieldDifference,
} from '../shared/types'

type TreeNode = {
  id: string
  type: string
  name: string
  parent: BaseNode | null
  children?: readonly SceneNode[]
}

export async function scanInstanceDiff(rootIds?: string[]): Promise<DiffScanPayload> {
  const roots = await resolveRoots(rootIds)
  const instances = uniqueInstances(roots.flatMap((root) => discoverInstances(root)))
  const changed: InstanceDiff[] = []
  let unchangedInstanceCount = 0

  for (const instance of instances) {
    const result = await scanInstance(instance, roots)
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

async function scanInstance(instance: InstanceNode, roots: SceneNode[]): Promise<InstanceDiff> {
  const main = await instance.getMainComponentAsync()
  const componentProperties = main
    ? compareComponentProperties(instance, main)
    : []
  const differences: LayerFieldDifference[] = []

  for (const override of instance.overrides) {
    const affected = await getSceneNode(override.id)
    if (!affected) continue
    if (nearestInstanceOwner(affected)?.id !== instance.id) continue

    const original = main ? mapToOriginal(instance, main, affected) : null
    for (const field of override.overriddenFields) {
      if (field === 'componentProperties') continue
      const originalValue = original ? readNodeField(original, field) : undefined
      const currentValue = readNodeField(affected, field)
      if (original && valuesEqual(originalValue, currentValue)) continue
      differences.push({
        id: `${instance.id}|${affected.id}|${field}`,
        affectedNodeId: affected.id,
        affectedNodeName: affected.name,
        affectedNodeType: affected.type,
        nodePath: pathWithin(instance, affected),
        field,
        label: friendlyFieldLabel(field),
        category: categoryForField(field),
        original: normalizeDiffValue(originalValue),
        current: normalizeDiffValue(currentValue),
        mapping: original ? 'exact' : 'unavailable',
      })
    }
  }

  const layers = groupLayerDifferences(differences)
  const differenceCount =
    componentProperties.length + differences.length
  return {
    instanceId: instance.id,
    instanceName: instance.name,
    instancePath: pathFromSelectedRoot(roots, instance),
    mainComponentId: main?.id ?? null,
    mainComponentName: main?.name ?? 'Main component unavailable',
    mainComponentRemote: main?.remote ?? false,
    componentProperties,
    layers,
    differenceCount,
  }
}

function compareComponentProperties(
  instance: InstanceNode,
  main: ComponentNode,
): ComponentPropertyDifference[] {
  const definitions =
    main.parent?.type === 'COMPONENT_SET'
      ? main.parent.componentPropertyDefinitions
      : main.componentPropertyDefinitions
  const result: ComponentPropertyDifference[] = []
  for (const [propertyKey, currentProperty] of Object.entries(instance.componentProperties)) {
    const definition = definitions[propertyKey]
    const original =
      currentProperty.type === 'VARIANT'
        ? main.variantProperties?.[propertyKey] ?? definition?.defaultValue
        : definition?.defaultValue
    if (valuesEqual(original, currentProperty.value)) continue
    result.push({
      id: `${instance.id}|component-property|${propertyKey}`,
      propertyKey,
      propertyName: friendlyPropertyName(propertyKey),
      propertyType: currentProperty.type,
      original: normalizeDiffValue(original),
      current: normalizeDiffValue(currentProperty.value),
    })
  }
  return result
}

function groupLayerDifferences(differences: LayerFieldDifference[]): DiffLayerGroup[] {
  const groups = new Map<string, DiffLayerGroup>()
  for (const difference of differences) {
    const current = groups.get(difference.affectedNodeId) ?? {
      nodeId: difference.affectedNodeId,
      nodeName: difference.affectedNodeName,
      nodeType: difference.affectedNodeType,
      nodePath: difference.nodePath,
      differences: [],
    }
    current.differences.push(difference)
    groups.set(difference.affectedNodeId, current)
  }
  return [...groups.values()]
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
  const visit = (node: SceneNode) => {
    if (node.type === 'INSTANCE') found.push(node)
    if ('children' in node) {
      for (const child of node.children) visit(child)
    }
  }
  visit(root)
  return found
}

function uniqueInstances(instances: InstanceNode[]): InstanceNode[] {
  return [...new Map(instances.map((instance) => [instance.id, instance])).values()]
}

async function getSceneNode(id: string): Promise<SceneNode | null> {
  const node = await figma.getNodeByIdAsync(id)
  return node && node.type !== 'DOCUMENT' && node.type !== 'PAGE' ? node : null
}

function nearestInstanceOwner(node: SceneNode): InstanceNode | null {
  let current: BaseNode | null = node
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.type === 'INSTANCE') return current
    current = current.parent
  }
  return null
}

function mapToOriginal(
  instance: InstanceNode,
  main: ComponentNode,
  affected: SceneNode,
): SceneNode | null {
  if (affected.id === instance.id) return main
  const path = structuralIndexPath(instance, affected)
  if (!path) return null
  const candidate = nodeAtIndexPath(main, path)
  return candidate && candidate.type === affected.type ? candidate : null
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

function readNodeField(node: SceneNode, field: string): unknown {
  try {
    if (field === 'styledTextSegments' && node.type === 'TEXT') {
      return node.getStyledTextSegments([
        'fontName',
        'fontSize',
        'fills',
        'lineHeight',
        'letterSpacing',
        'textStyleId',
        'fillStyleId',
      ])
    }
    return (node as unknown as Record<string, unknown>)[field]
  } catch {
    return undefined
  }
}

function pathWithin(root: SceneNode, node: SceneNode): string[] {
  if (root.id === node.id) return [root.name]
  const result = [node.name]
  let current = node.parent
  while (current && current.id !== root.id && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
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
