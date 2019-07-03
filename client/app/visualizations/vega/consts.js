// const vegaSchema = require('vega/build/vega-schema.json');
// const vegaLiteSchema = require('vega-lite/build/vega-lite-schema.json');

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

// export const SCHEMAS = {
//   [Mode.Vega]: vegaSchema,
//   [Mode.VegaLite]: vegaLiteSchema,
// };

export const VEGA_LITE_START_SPEC = `{
  "$schema": "https://vega.github.io/schema/vega-lite/v3.json",
  "description": "{{ query.name }}",
  "autosize": "fit",
  "data": {
    "name": "current_query",
    "url": "{{ dataUrl }}",
    "format": {
      "type": "csv",
      "parse": {
        "{{ x.name }}": "date:{{ dateFormat }}"
      }
    }
  },
  "transform": [{
    "fold": {{ yFields }},
    "as": ["series", "value"]
  }],
  "mark": "area",
  "encoding": {
    "x": {
      "field": "{{ x.name }}",
      "type": "temporal",
      "axis": {
        "format": "{{ dateFormat }}",
        "title": "{{ x.friendly_name }}"
      }
    },
    "y": {
      "field": "value",
      "type": "quantitative",
      "aggregate": "sum",
      "axis": {
        "format": "s",
        "title": ""
      }
    },
    "color": {
      "field": "series",
      "type": "nominal",
      "sort": {{ yFields }}
    }
  }
}`;

export const DEFAULT_SPECS = {
  [Mode.Vega]: {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
  },
  [Mode.VegaLite]: {
    $schema: 'https://vega.github.io/schema/vega-lite/v3.json',
  },
};

// themes in use
export const THEMES = [
  'custom',
  'bold',
  'pastel',
  'prism',
  'excel',
  'ggplot2',
  'quartz',
  'vox',
  'fivethirtyeight',
  'latimes',
];
export const THEME_NAMES = {
  custom: 'Custom Theme',
  bold: 'Carto Bold',
  pastel: 'Carto Pastel',
  prism: 'Carto Prism',
  dark: 'Dark',
  excel: 'Microsoft Excel',
  ggplot2: 'ggplot2',
  quartz: 'Quartz',
  vox: 'Vox',
  fivethirtyeight: '538',
  latimes: 'Los Angeles Times',
};

export const DEFAULT_OPTIONS = {
  lang: 'yaml',
  mode: Mode.VegaLite,
  spec: '',
  theme: 'custom',
};
