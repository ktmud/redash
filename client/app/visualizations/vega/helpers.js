import Mustache from 'mustache';
import YAML from 'js-yaml';
import * as vegaThemes from 'vega-themes';
import * as vl from 'vega-lite';
import stringify from 'json-stringify-pretty-compact';

import { getQueryDataUrl } from '@/components/queries/index';
import { clientConfig } from '@/services/auth';
import { message } from 'antd';

import { Mode, VEGA_LITE_START_SPEC, DEFAULT_SPECS } from './consts';
import redashThemes from './theme';

function convertDateFormat(momentFormat) {
  return momentFormat
    .replace('YYYY', '%Y')
    .replace('YY', '%y')
    .replace('MM', '%m')
    .replace('DD', '%d')
    .replace('HH', '%h')
    .replace('mm', '%m')
    .replace('ss', '%s');
}

/**
 * Render initial spec text based on column types
 */
export function renderInitialSpecText(options, { data, query }) {
  let x = null;
  const yFields = [];
  const { spec: specText, lang, mode, theme } = options;
  let { origLang, origMode } = options;
  let spec = { ...DEFAULT_SPECS[mode] };

  // if spec is empty, render the default spec
  if (!specText || !specText.trim()) {
    // since we are rendering from JSON & Vega-Lite, set origLang & origMode
    // to appropriate values
    origLang = 'json';
    origMode = Mode.VegaLite;
    // infer xy fields based on data types
    if (data && data.columns && data.columns.length > 0) {
      data.columns.forEach((col) => {
        // default Vega schema expects "date" and "count" field
        if (x === null && col.type === 'date') {
          x = col;
        } else if (['float', 'integer', 'number'].includes(col.type)) {
          yFields.push(col.name);
        }
      });
    }
    const dateFormat = convertDateFormat(clientConfig.dateFormat || 'YYYY-MM-DD');
    const params = {
      x,
      yFields: stringify(yFields),
      query,
      dateFormat,
      dataUrl: getQueryDataUrl(query.id, 'csv', query.api_key, false),
    };
    // render as Vega-lite JSON first
    spec = Mustache.render(VEGA_LITE_START_SPEC, params);
    spec = parseSpecText({ spec, lang: 'json', mode: Mode.VegaLite }).spec;
    applyTheme(spec, theme);
  } else {
    const result = parseSpecText({ spec: specText, lang: origLang, mode: origMode });
    spec = result.spec;
    if (result.error) {
      message.error(`Could not parse existing spec as ${lang}`);
    }
  }

  const { width, height } = spec;
  // if original mode is Vega-lite, convert to vega
  if (origMode === Mode.VegaLite && mode === Mode.Vega) {
    try {
      spec = vl.compile(spec).spec;
    } catch (err) {
      // silently exit
    }
    // revert width & height values (so we can have auto resize)
    // must remove undefined values, otherwise YAML dump will fail
    if (!width) {
      delete spec.width;
    }
    if (!height) {
      delete spec.height;
    }
  }
  return dumpSpecText(spec, lang, specText);
}

export function dumpSpecText(spec, lang, origText = '') {
  try {
    if (lang === 'yaml') {
      return YAML.safeDump(spec);
    }
    return stringify(spec);
  } catch (err) {
    return origText;
  }
}

export function yaml2json(specText, mode) {
  const { error, spec } = parseSpecText({ spec: specText, lang: 'yaml', mode });
  specText = stringify(spec);
  return { error, specText };
}

export function json2yaml(specText, mode) {
  const { error, spec } = parseSpecText({ spec: specText, lang: 'json', mode });
  specText = YAML.safeDump(spec);
  return { error, specText };
}

/**
 * Apply theme config to the spec
 */
export function applyTheme(spec, theme) {
  // do nothing if this is a custom theme
  if (!spec) return;
  const config = redashThemes[theme] || vegaThemes[theme];
  if (config) {
    spec.config = { ...config };
  }
  return spec;
}

/**
 * Parse spec text to JS object
 */
export function parseSpecText({ spec: specText, lang, mode }) {
  let error = null;
  let spec = { ...DEFAULT_SPECS[mode] };

  // if empty string, return the default spec
  if (!specText || !specText.trim()) {
    return { error: 'You entered an empty spec', spec };
  }
  // if lang is not specified, try parse as JSON first
  if (!lang || lang === 'json') {
    try {
      spec = JSON.parse(specText);
      lang = 'json';
    } catch (err) {
      error = err.message;
    }
  }
  // try parse as YAML, too
  if (!lang || lang === 'yaml') {
    try {
      const loaded = YAML.safeLoad(specText);
      lang = 'yaml';
      if (loaded === specText) {
        error = 'Invalid spec';
      } else {
        spec = loaded;
      }
    } catch (err) {
      error = err.message;
    }
  }
  // infer mode if not set
  if (!mode && spec && spec.$schema && spec.$schema.indexOf('vega-lite') !== -1) {
    mode = Mode.VegaLite;
  } else {
    mode = Mode.Vega;
  }
  return { error, spec, lang, mode };
}
