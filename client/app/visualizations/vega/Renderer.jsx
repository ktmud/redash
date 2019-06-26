import React from 'react';
import Vega from 'react-vega';
import * as vl from 'vega-lite';
// import * as YAML from 'js-yaml';
import { Handler } from 'vega-tooltip';
import { Alert, Icon } from 'antd';
import LZString from 'lz-string';

import { RendererPropTypes } from '../index';
import { Mode, NAMES } from './consts';

import './vega.less';
import { parseSpecText, yaml2json } from './helpers';

/**
 * Parse Vega spec in props based on chosen language and
 * vega mode (lite or not).
 *
 * @param {object} props properties passed from React
 */
function parseProps({ lang, mode, spec }, data) {
  let error = null;

  // if empty spec
  if (!spec.trim()) {
    return { error: 'You entered an empty spec', mode, spec, data: [] };
  }

  const parsed = parseSpecText({ spec, lang, mode });
  error = parsed.error;
  spec = parsed.spec; // if error, spec will be default spec

  if (error) {
    return { error, mode, spec, data: [] };
  }

  // If source is VegaLite spec, convert to Vega
  if (mode === Mode.VegaLite) {
    try {
      spec = vl.compile(spec).spec;
    } catch (err) {
      error = err.message;
    }
  }

  const specData = spec.data && spec.data[0];
  if (data && specData && specData.name === 'query_results') {
    // Inject actual data to the data source in spec
    specData.values = data.rows;
    delete specData.url;
    delete specData.format;
  }

  return { error, mode, spec, data };
}

export default class VegaRenderer extends React.Component {
  static propTypes = RendererPropTypes;

  // shouldComponentUpdate(nextProps, nextState) {
  //   return false;
  // }

  render() {
    const props = this.props;
    const options = props.options;
    const { error, mode, spec } = parseProps(options, props.data);
    const alertContent = (
      <React.Fragment>
        {' '}
        {error && error !== 'Invalid spec' ? (
          <React.Fragment>
            {' '}
            <strong>{error}</strong>.{' '} <br />
          </React.Fragment>
        ) : null}{' '}
        See{' '}
        <a target="_blank" rel="noopener noreferrer" href={`https://vega.github.io/${mode}/examples/`}>
          {' '}
          Example Gallery{' '}
        </a>
        fore inspirations.
      </React.Fragment>
    );
    const alertInvalidSpec = (
      <Alert message={`Invalid ${NAMES[mode]} Spec`} description={alertContent} type="warning" showIcon />
    );
    const width = spec.width;
    const height = spec.height;
    let editLink = null;

    if (this.props.fromEditor) {
      const vegaEditorBase = 'https://vega.github.io/editor/';
      const vegaUrl = `${vegaEditorBase}#/custom/${mode}/`;
      const updateVegaUrl = (e) => {
        let specText = options.spec;
        if (options.lang === 'yaml') {
          specText = yaml2json(spec, mode);
        }
        const compressed = LZString.compressToEncodedURIComponent(specText);
        e.target.href = `${vegaEditorBase}#/url/${mode}/${compressed}`;
      };
      editLink = (
        <div className="vega-external-link">
          <a href={vegaUrl} target="_blank" rel="noopener noreferrer" onMouseEnter={updateVegaUrl}>
            <Icon type="edit" /> Edit in Official Vega Editor
          </a>
        </div>
      );
    }

    return (
      <div className="vega-visualization-container">
        {error ? (
          alertInvalidSpec
        ) : (
          <Vega
            className="vega-canvas-container"
            ref={(elem) => {
              this.vega = elem;
            }}
            spec={spec}
            width={width}
            height={height}
            enableHover
            tooltip={new Handler().call}
          />
        )}
        {editLink}
      </div>
    );
  }
}
