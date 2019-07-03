import stringify from 'json-stringify-pretty-compact';
import ResizeObserver from 'resize-observer-polyfill';
import { isObject } from 'lodash';
import React from 'react';
import Vega from 'react-vega';
import * as vl from 'vega-lite';
// import * as YAML from 'js-yaml';
import { Handler } from 'vega-tooltip';
import { Alert, Icon } from 'antd';
import LZString from 'lz-string';
import memoize from 'memoize-one';

import { RendererPropTypes } from '../index';
import { Mode, NAMES } from './consts';
import { parseSpecText, yaml2json, applyTheme } from './helpers';
import './vega.less';

function getElemPadding(elem) {
  const style = getComputedStyle(elem);
  return {
    left: parseInt(style.getPropertyValue('padding-left'), 10) || 0,
    right: parseInt(style.getPropertyValue('padding-right'), 10) || 0,
    top: parseInt(style.getPropertyValue('padding-top'), 10) || 0,
    bottom: parseInt(style.getPropertyValue('padding-bottom'), 10) || 0,
  };
}

// the container to which we auto-resize the visualization
const CONTAINER_SELECTORS = ['.query__vis', '.scrollbox', '.modal-body'].join(',');

export default class VegaRenderer extends React.PureComponent {
  static propTypes = RendererPropTypes;

  /**
   * Parse Vega spec in props based on chosen language and
   * vega mode (lite or not).
   *
   * Since we used memoization, this function must be an instance method
   *
   * @param {object} props properties passed from React
   */
  parseOptions = memoize(({ lang, mode, spec, theme }, compileLite = true) => {
    let error = null;
    const parsed = parseSpecText({ spec, lang, mode });
    error = parsed.error;
    spec = parsed.spec; // if error, spec will be default spec

    // Always apply the them in config
    applyTheme(spec, theme);

    if (error) {
      return { error, mode, spec };
    }

    // when either width or height is unset, enable autoresize
    const { width, height } = spec;
    const autoresize = !width || !height;

    // If source is VegaLite spec, convert to Vega
    if (compileLite && mode === Mode.VegaLite) {
      try {
        spec = vl.compile(spec).spec;
      } catch (err) {
        error = err.message;
      }
      // revert to origin height if we are doing autoresize
      // (Vega-Lite will set default size as 200x200)
      if (autoresize) {
        spec.width = width;
        spec.height = height;
      }
    }

    return { error, mode, spec, autoresize };
  });

  constructor(props) {
    super(props);
    this.state = {
      parentSize: null,
    };
  }

  componentDidMount() {
    // eslint-disable-next-line compat/compat
    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      // make sure sizes are not zeros
      if (rect.width && rect.height) {
        this.updateLayout();
      }
    });
    this.resizeObserver.observe(this.elem.closest(CONTAINER_SELECTORS));
  }

  componentDidUpdate() {
    this.updateLayout();
  }

  componentWillUnmount() {
    this.resizeObserver.disconnect();
  }

  getParentSize() {
    const parent = this.elem.closest(CONTAINER_SELECTORS) || this.elem;
    const bounds = parent.getBoundingClientRect();
    return {
      node: parent,
      width: Math.floor(bounds.width),
      height: Math.floor(bounds.height),
    };
  }

  /**
   * Parse component.props
   */
  parseProps = ({ options, data }) => {
    const { error, mode, spec, autoresize } = this.parseOptions(options);
    const specData = spec.data && spec.data[0];
    if (data && specData && specData.name === 'current_query') {
      // Inject actual data to the data source in spec
      specData.values = data.rows;
      // ignore `url` and `format` config
      delete specData.url;
      delete specData.format;
    }
    if (!specData) {
      spec.data = [{ values: data.rows }];
    }
    return { error, mode, spec, autoresize };
  };

  /**
   * Calculate the height and width in pixels based on
   *    1. spec specification
   *    2. parent container size.
   */
  autoLayout({ error, spec, autoresize } = {}) {
    let width = 0;
    let height = 0;

    if (!this.elem || error) return { width, height };

    const { width: specWidth, height: specHeight } = spec;
    if (!autoresize) return { width: specWidth, height: specHeight };

    // obtain prent size and adjust for parent padding
    const parent = this.state.parentSize;
    if (!parent) return { width, height };

    const padding = getElemPadding(parent.node);
    width = Math.max(0, parent.width - padding.left - padding.right);
    height = Math.max(0, parent.height - padding.top - padding.bottom);

    // adjust for Vega view padding
    let hPadding = 10;
    let vPadding = this.props.fromEditor ? 30 : 0;
    const specPadding = spec.padding !== undefined ? spec.padding : 5;
    if (typeof spec.padding === 'number') {
      hPadding += 2 * specPadding;
      vPadding += 2 * specPadding;
    } else if (isObject(specPadding)) {
      hPadding += (specPadding.left || 0) + (specPadding.right || 0);
      vPadding += (specPadding.top || 0) + (specPadding.bottom || 0);
    }
    width = Math.floor(specWidth || width) - hPadding;
    height = Math.floor(specHeight || height) - vPadding;
    return { width, height };
  }

  /**
   * Updaete width & height in spec based on parent size,
   * but don't sync the width/height pixels into spec, because
   * we want the spec to be stored as autoresize, unless
   * users specifically set width and height.
   *
   * This is also why we are only updating state and operate
   * on vega.view directly.)
   *
   * @param {number} parentSize - parent width and height
   * @param {number} width - manual width in pixels
   * @param {number} height - manual height in pixels
   */
  updateLayout() {
    if (!this.vega || !this.vega.view) return;
    const newSize = this.getParentSize();
    const oldSize = this.state.parentSize;
    if (!oldSize || Math.abs(newSize.width - oldSize.width) > 2 || Math.abs(newSize.height - oldSize.height) > 2) {
      this.setState({ parentSize: newSize });
    }
  }

  render() {
    const props = this.props;
    const options = props.options;
    // parseProps is cached by memoization
    const { error, mode, spec, autoresize } = this.parseProps(this.props);
    const { width, height } = this.autoLayout({ error, spec, autoresize });
    const alertContent = (
      <React.Fragment>
        {' '}
        {error ? (
          <React.Fragment>
            {' '}
            <strong>{error === 'Invalid spec' ? 'Your spec is not valid' : error}</strong>. <br />
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

    // if calling from editor, append an edit link
    let editLink = null;
    if (this.props.fromEditor) {
      const vegaEditorBase = 'https://vega.github.io/editor/';
      const vegaUrl = `${vegaEditorBase}#/custom/${mode}/`;

      // Obtain the raw spec from text, so we can link to both Vega and Vega-Lite
      const updateVegaUrl = (e) => {
        let specText = options.spec;
        if (options.lang === 'yaml') {
          specText = yaml2json(specText, mode).specText;
        }
        if (autoresize) {
          let updatedSpec = { ...spec };
          if (mode === Mode.VegaLite) {
            updatedSpec = this.parseOptions(this.props.options, false).spec;
          }
          updatedSpec.width = width;
          updatedSpec.height = height;
          specText = stringify(updatedSpec);
        }
        const compressed = LZString.compressToEncodedURIComponent(specText);
        e.target.href = `${vegaEditorBase}#/url/${mode}/${compressed}`;
      };

      editLink = (
        <div className="vega-external-link">
          <a href={vegaUrl} target="_blank" rel="noopener noreferrer" onClick={updateVegaUrl}>
            <Icon type="edit" /> Edit in Official Vega Editor
          </a>
        </div>
      );
    }

    return (
      <div
        className="vega-visualization-container"
        ref={(elem) => {
          this.elem = elem;
        }}
      >
        {error ? (
          alertInvalidSpec
        ) : (
          <Vega
            className="vega-canvas-container"
            ref={(elem) => {
              this.vega = elem;
            }}
            width={width}
            height={height}
            spec={spec}
            enableHover
            tooltip={new Handler().call}
          />
        )}
        {editLink}
      </div>
    );
  }
}
