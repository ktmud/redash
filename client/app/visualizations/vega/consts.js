const vegaSchema = require('vega/build/vega-schema.json');
const vegaLiteSchema = require('vega-lite/build/vega-lite-schema.json');

export const Mode = {
  Vega: 'vega',
  VegaLite: 'vega-lite',
};

export const NAME_TO_MODE = {
  vega: Mode.Vega,
  'vega-lite': Mode.VegaLite,
};

export const NAMES = {
  [Mode.Vega]: 'Vega',
  [Mode.VegaLite]: 'Vega-Lite',
};

export const VEGA_LITE_START_SPEC = `{
  "$schema": "https://vega.github.io/schema/vega-lite/v3.json",
  "description": "{{ query.name }}",
  "width": 500,
  "height": 300,
  "autosize": "fit",
  "data": {
    "name": "query_results",
    "url": "{{ dataUrl }}",
    "format": {"type": "csv"}
  },
  "mark": "area",
  "encoding": {
    "x": {
      "timeUnit": "day", "field": "{{ x.name }}", "type": "temporal",
      "axis": {"format": "{{ dateFormat }}", "title": "{{ x.friendly_name }}"}
    },
    "y": {
      "aggregate": "sum", "field": "{{ y.name }}", "type": "quantitative",
      "axis": {"format": "~s", "title": "{{ y.friendly_name }}"}
    }
  }
}`;

export const MONACO_SCHEMAS = [
  {
    fileMatch: [`${Mode.Vega}.*`],
    schema: vegaSchema,
    uri: 'https://vega.github.io/schema/vega/v5.json',
  },
  {
    fileMatch: [`${Mode.VegaLite}.*`],
    schema: vegaLiteSchema,
    uri: 'https://vega.github.io/schema/vega-lite/v3.json',
  },
];

export const DEFAULT_SPECS = {
  [Mode.Vega]: {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
  },
  [Mode.VegaLite]: {
    $schema: 'https://vega.github.io/schema/vega-lite/v3.json',
  },
};

// themes in use
export const THEMES = ['custom', 'redash', 'excel', 'ggplot2', 'quartz', 'vox', 'fivethirtyeight', 'latimes'];
export const THEME_NAMES = {
  custom: 'Custom Theme',
  redash: 'Redash',
  dark: 'Dark',
  excel: 'Microsoft Excel',
  ggplot2: 'ggplot2',
  quartz: 'Quartz',
  fivethirtyeight: '538',
  latimes: 'Los Angeles Times',
};

export const DEFAULT_OPTIONS = {
  lang: 'json',
  mode: Mode.VegaLite,
  spec: '',
  theme: 'custom',
};
