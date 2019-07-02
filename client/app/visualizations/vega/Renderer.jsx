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
    // In case we updated theme in the JavaScript module,
    // but the stored spec still has the old theme
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
    this.state = { width: 0, height: 0 };
  }

  componentDidMount() {
    // eslint-disable-next-line compat/compat
    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      // make sure sizes are not zeros
      if (rect.width && rect.height) {
        this.updateLayout(rect);
      }
    });
    this.resizeObserver.observe(this.elem.offsetParent || this.elem);
  }

  componentWillUnmount() {
    this.resizeObserver.disconnect();
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
   * Calculate the height and width in pixels based on spec specification
   * and parent container size
   */
  autoLayout(parentSize) {
    const { error, spec, autoresize } = this.parseOptions(this.props.options);
    if (!this.elem || error) return { width: 0, height: 0 };
    let { width, height } = spec;
    if (autoresize) {
      // automatically get parent size
      if (!parentSize) {
        const node = this.elem.offsetParent || this.elem;
        const bounds = node.getBoundingClientRect();
        parentSize = bounds;
      }
      const { width: specWidth, height: specHeight } = spec;
      let hPadding = 20;
      // if from editor, needs space for the edit link
      let vPadding = this.props.fromEditor ? 40 : 5;
      if (typeof spec.padding === 'number') {
        hPadding += 2 * spec.padding;
        vPadding += 2 * spec.padding;
      } else if (isObject(spec.padding)) {
        hPadding += (spec.padding.left || 0) + (spec.padding.right || 0);
        vPadding += (spec.padding.top || 0) + (spec.padding.bottom || 0);
      }
      width = Math.round(specWidth || Math.max(parentSize.width - hPadding, 100));
      height = Math.round(specHeight || Math.min(450, Math.max(parentSize.height - vPadding, 320)));
    } else {
      width = spec.width;
      height = spec.height;
    }

    return { width, height };
  }

  /**
   * Updaete width & height in spec based on parent size
   *
   * @param {number} parentSize - parent width and height
   * @param {number} width - manual width in pixels
   * @param {number} height - manual height in pixels
   */
  updateLayout(parentSize) {
    // when there is error message or element is unmounting
    // these elements might be null
    if (!this.vega || !this.vega.view) return {};
    const { width, height } = this.autoLayout(parentSize);
    if (width !== this.state.width || height !== this.state.height) {
      // save current width & height to state
      this.setState({ width, height }, () => {
        // but manually update vega view size
        this.vega.view.width(width);
        this.vega.view.height(height);
      });
    }
  }

  render() {
    const props = this.props;
    const options = props.options;
    // parseProps is cached by memoization
    const { error, mode, spec, autoresize } = this.parseProps(this.props);
    const { width, height } = this.autoLayout();
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
