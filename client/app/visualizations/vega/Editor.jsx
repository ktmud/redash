import React from 'react';
import { Form, Select, message, Icon } from 'antd';
import { debounce } from 'lodash';
// import stringify from 'json-stringify-pretty-compact';
// import * as YAML from 'js-yaml';
import AceEditor from 'react-ace';
import { UndoManager, EditSession } from 'brace';

import { EditorPropTypes } from '../index';
import { Mode, THEMES, THEME_NAMES, DEFAULT_OPTIONS } from './consts';
import { renderInitialSpecText, parseSpecText, applyTheme, dumpSpecText } from './helpers';

// Initialize editor configuration (language support, etc.)
import '@/components/editor';

// Monaco diagnostics option
//
// const vegaSchema = require('vega/build/vega-schema.json');
// const vegaLiteSchema = require('vega-lite/build/vega-lite-schema.json');
//
// export const MONACO_SCHEMAS = [
//   {
//     fileMatch: [`${Mode.Vega}.*`],
//     schema: vegaSchema,
//     uri: 'https://vega.github.io/schema/vega/v5.json',
//   },
//   {
//     fileMatch: [`${Mode.VegaLite}.*`],
//     schema: vegaLiteSchema,
//     uri: 'https://vega.github.io/schema/vega-lite/v3.json',
//   },
// ];
// const monacoDiagnostics = {
//   allowComments: false,
//   enableSchemaRequest: false,
//   validate: true,
//   schemas: MONACO_SCHEMAS,
// };

// const jsonFormatter = {
//   provideDocumentFormattingEdits(model) {
//     return [
//       {
//         range: model.getFullModelRange(),
//         text: stringify(JSON.parse(model.getValue())),
//       },
//     ];
//   },
// };

// const yamlFormatter = {
//   provideDocumentFormattingEdits(model) {
//     return [
//       {
//         range: model.getFullModelRange(),
//         text: YAML.safeDump(YAML.safeLoads(model.getValue())),
//       },
//     ];
//   },
// };

/**
 * Add additional language support for the text editor
 */
// function setupEditor() {
//   monaco.languages.json.jsonDefaults.setDiagnosticsOptions(monacoDiagnostics);
//   monaco.languages.registerDocumentFormattingEditProvider('json', jsonFormatter);
//   monaco.languages.registerDocumentFormattingEditProvider('yaml', yamlFormatter);
// }

function createModel(initialValue, lang, uri) {
  // monaco.editor.createModel(initialValue, lang, uri);
  const model = new EditSession(initialValue, `ace/mode/${lang}`);
  model.setOption({ tabSize: 2 });
  model.setUndoManager(new UndoManager());
  model.uri = uri;
  return model;
}


const ONCHANGE_TIMEOUT = 700;

export default class VegaEditor extends React.Component {
  static propTypes = EditorPropTypes;

  constructor(props) {
    super(props);
    this.editor = null; // reference to the editor instance.
    this.state = { ...props.options };
    this.buffers = {}; // Editor model buffer based on lang & mode
    this.onPaste = this.onPaste.bind(this);
    this.updateSpec = this.updateSpec.bind(this);
    this.updateLang = this.updateLang.bind(this);
    this.updateTheme = this.updateTheme.bind(this);
    this.updateEditorBuffer = this.updateEditorBuffer.bind(this);
    this.editorDidMount = this.editorDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
  }

  componentWillUnmount() {
    this.buffers = {};
    // Object.values(this.buffers).forEach(buf => buf.model.dispose());
  }

  onPaste({ text: spec }) {
    const parsed = parseSpecText({ spec });
    this.pasting = true;
    if (!parsed.error) {
      // only update mode and lang
      const { mode, lang } = parsed;
      this.updateEditorBuffer({ mode, lang, spec: '' });
    }
    if (parsed.error) {
      message.error('Invalid Spec: ' + parsed.error);
    }
    setTimeout(() => {
      this.pasting = false;
    }, ONCHANGE_TIMEOUT);
  }

  getEditorBuffer(targetState) {
    const { spec, lang, mode, theme } = { ...this.state, ...targetState };
    const { lang: origLang, mode: origMode } = this.state;
    const uri = `internal://server/${mode}.${lang}`;
    const bufs = this.buffers;
    const buf = bufs[uri];
    let model = buf && buf.model;
    if (!buf) {
      const initialValue = renderInitialSpecText(
        {
          spec,
          lang,
          mode,
          theme,
          origLang,
          origMode,
        },
        this.props,
      );
      model = createModel(initialValue, lang, uri);
    }
    bufs[uri] = bufs[uri] || { model };
    return bufs[uri];
  }

  setOption(options, callback) {
    this.setState(options, (...args) => {
      // propagage the update to parent (EditVisualizationDialog)
      this.props.onOptionsChange({ ...this.state });
      if (callback) {
        callback.apply(this, ...args);
      }
    });
  }

  updateLang(lang) {
    this.updateEditorBuffer({ lang });
  }

  updateMode(mode) {
    this.updateEditorBuffer({ mode });
  }

  updateSpec(spec) {
    // don't trigger onChange event is still pasting
    if (this.pasting) return;
    this.setOption({ spec });
  }

  updateTheme(theme) {
    const { spec: specText, lang, mode } = this.state;
    const { error, spec } = parseSpecText({ spec: specText, lang, mode });
    if (error) {
      message.error('Theme not applied because your spec is invalid.');
    }
    applyTheme(spec, theme);
    const updatedSpecText = dumpSpecText(spec, this.state.lang);
    this.setOption({ spec: updatedSpecText, theme });
  }

  /**
   * Update editor buffer corresponds to the target lang & mode
   */
  updateEditorBuffer(targetState = {}) {
    if (!this.editor) return;
    const editor = this.editor;
    const newBuf = this.getEditorBuffer(targetState);
    const curModel = editor.getSession();
    if (curModel !== newBuf.model) {
      // if (curModel) {
      //   this.buffers[curModel.uri].viewState = editor.saveViewState();
      // }
      editor.setSession(newBuf.model);
      // if (newBuf.viewState) {
      //   editor.restoreViewState(newBuf.viewState);
      // }
    }
    // sync text between editor and state
    if ('spec' in targetState) {
      newBuf.model.setValue(targetState.spec);
    } else {
      targetState.spec = newBuf.model.getValue();
    }
    this.setOption(targetState);
  }

  editorDidMount(editor) {
    this.editor = editor;
    this.updateEditorBuffer();
  }

  render() {
    const { lang, mode, spec, theme: _theme } = this.state;
    // make sure theme is acceptable value
    const theme = THEMES.includes(_theme) ? _theme : DEFAULT_OPTIONS.theme;

    return (
      <div className="vega-spec-editor">
        <Form.Item>
          <Select style={{ width: '6.5em' }} value={lang} onChange={target => this.updateLang(target)}>
            <Select.Option key="yaml"> YAML </Select.Option>
            <Select.Option key="json"> JSON </Select.Option>
          </Select>
          <Select style={{ width: '8em' }} value={mode} onChange={target => this.updateMode(target)}>
            <Select.Option key={Mode.Vega}> Vega </Select.Option>
            <Select.Option key={Mode.VegaLite}> Vega Lite </Select.Option>
          </Select>
          <Select
            style={{ width: '12.5em' }}
            defaultValue="custom"
            value={theme}
            onChange={target => this.updateTheme(target)}
          >
            {THEMES.map(value => (
              <Select.Option key={value}> {THEME_NAMES[value]} </Select.Option>
            ))}
          </Select>
          <a
            className="vega-help-link"
            href="https://vega.github.io/vega-lite/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon type="question-circle" /> What is Vega?
          </a>
        </Form.Item>
        <AceEditor
          height="55vh" // 55% viewport height
          width="auto"
          theme="textmate"
          value={spec}
          mode={lang}
          setOptions={{
            mergeUndoDeltas: true,
            behavioursEnabled: true,
            enableSnippets: false,
            enableBasicAutocompletion: true,
            autoScrollEditorIntoView: false,
          }}
          editorProps={{ $blockScrolling: Infinity }}
          showPrintMargin={false}
          wrapEnabled={false}
          onPaste={this.onPaste}
          onChange={debounce(this.updateSpec, ONCHANGE_TIMEOUT)}
          onLoad={this.editorDidMount}
        />
      </div>
    );
  }
}
