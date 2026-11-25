// -----------------------------------------------------------------------------
// Parsing of the Wolf SmartSet GUI description into a flat parameter list.
//
// `GetGuiDescriptionForGateway` returns the menu tree the portal renders: tab
// views holding `ParameterDescriptors`. The normal mode keeps the tab views of
// the first menu (what the end user sees in the portal); the expert mode walks
// the whole tree, every descriptor of every menu. Pure functions: no I/O.
// -----------------------------------------------------------------------------

import { DEFAULT_BUNDLE_ID, NAME_SEPARATOR } from './constants.js';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
};

/**
 * Map one raw descriptor to the parameter shape the integration uses.
 */
export function mapDescriptor(descriptor, { group = null, bundleId = null, units = {} } = {}) {
  const valueId = descriptor.ValueId;
  if (valueId === undefined || valueId === null) {
    return null;
  }
  const unit = descriptor.Unit ?? units[valueId] ?? null;
  const items = Array.isArray(descriptor.ListItems)
    ? descriptor.ListItems.map((item) => ({
        value: String(item.Value),
        label: String(item.DisplayText ?? item.Value),
      }))
    : null;
  return {
    valueId,
    parameterId: descriptor.ParameterId ?? valueId,
    bundleId: descriptor.BundleId ?? bundleId ?? DEFAULT_BUNDLE_ID,
    rawName: String(descriptor.Name ?? valueId),
    name: String(descriptor.Name ?? valueId),
    group,
    unit: unit === '' ? null : unit,
    // The portal treats a descriptor without the flag as read-only.
    readOnly: descriptor.IsReadOnly !== false,
    items: items && items.length > 0 ? items : null,
    min: toNumber(descriptor.MinValue),
    max: toNumber(descriptor.MaxValue),
    decimals: toNumber(descriptor.Decimals),
    step: toNumber(descriptor.StepWidth),
  };
}

// The heating schema views carry the units of their descriptors aside.
function schemaUnits(view) {
  const units = {};
  for (const device of view.SVGHeatingSchemaConfigDevices ?? []) {
    for (const parameter of device.parameters ?? []) {
      if (parameter.unit) {
        units[parameter.valueId] = parameter.unit;
      }
    }
  }
  return units;
}

function normalModeParameters(description) {
  const tabViews = description?.MenuItems?.[0]?.TabViews ?? [];
  return tabViews.flatMap((view) => {
    const units = schemaUnits(view);
    return (view.ParameterDescriptors ?? []).map((descriptor) =>
      mapDescriptor(descriptor, { group: view.TabName ?? null, bundleId: view.BundleId, units }),
    );
  });
}

function expertModeParameters(description) {
  const found = [];
  const walk = (node, bundleId, group) => {
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, bundleId, group));
      return;
    }
    if (node === null || typeof node !== 'object') {
      return;
    }
    const ownBundle = node.BundleId ?? bundleId;
    const ownGroup = node.TabName ?? node.Name ?? group;
    if (Array.isArray(node.ParameterDescriptors)) {
      for (const descriptor of node.ParameterDescriptors) {
        found.push(mapDescriptor(descriptor, { group: ownGroup, bundleId: ownBundle }));
      }
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'ParameterDescriptors' && typeof child === 'object') {
        walk(child, ownBundle, ownGroup);
      }
    }
  };
  walk(description, null, null);
  return found.sort((a, b) => (a?.valueId ?? 0) - (b?.valueId ?? 0));
}

/**
 * Translate a raw name with the portal's own texts ("Heizkreis---Vorlauf"
 * becomes "Heating circuit Flow" in English). Unknown keys stay as they are.
 */
export function localizeName(rawName, texts = {}) {
  const translate = (key) => (Object.hasOwn(texts, key) ? texts[key] : key);
  const parts = rawName.split(NAME_SEPARATOR);
  if (parts.length === 2) {
    const prefix = parts[0].includes('_') ? parts[0].split('_')[1] : parts[0];
    return `${translate(prefix)} ${translate(parts[1])}`.trim();
  }
  return translate(rawName);
}

/**
 * Flatten the GUI description into unique parameters (one per `ValueId`,
 * the first occurrence wins), with localized names.
 */
export function parseGuiDescription(description, { expert = false, texts = {} } = {}) {
  const raw = expert ? expertModeParameters(description) : normalModeParameters(description);
  const seen = new Set();
  const parameters = [];
  for (const parameter of raw) {
    if (!parameter || seen.has(parameter.valueId)) {
      continue;
    }
    seen.add(parameter.valueId);
    parameters.push({ ...parameter, name: localizeName(parameter.rawName, texts) });
  }
  return parameters;
}

/**
 * Parse the `messages` object of the portal's localized texts script
 * (`text.culture.<code>.js`). The script is JavaScript, not JSON: entries the
 * JSON parser refuses (comments, trailing commas...) are dropped line by line
 * rather than evaluating third-party code.
 */
export function parseLocalizedTexts(script) {
  const match = /messages:\s*(\{[\s\S]*?\})\s*\}/.exec(script ?? '');
  if (!match) {
    return null;
  }
  let lines = match[1].split('\n');
  for (let attempt = 0; attempt < 1000 && lines.length > 0; attempt += 1) {
    const text = lines.join('\n');
    try {
      return JSON.parse(text);
    } catch (err) {
      const position = /position (\d+)/.exec(err.message);
      const lineMatch = /line (\d+)/.exec(err.message);
      let line;
      if (lineMatch) {
        line = Number(lineMatch[1]) - 1;
      } else if (position) {
        line = text.slice(0, Number(position[1])).split('\n').length - 1;
      } else {
        line = lines.length - 1;
      }
      // Never drop the opening or closing brace: drop the line before instead.
      if (line <= 0) line = 1;
      if (line >= lines.length - 1) line = lines.length - 2;
      if (line <= 0) {
        return null;
      }
      lines = [...lines.slice(0, line), ...lines.slice(line + 1)];
    }
  }
  return null;
}
