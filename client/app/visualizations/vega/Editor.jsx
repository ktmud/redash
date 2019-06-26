import React from 'react';
import { Form, Select, message, Icon } from 'antd';
import MonacoEditor from 'react-monaco-editor';
import { debounce } from 'lodash';
import stringify from 'json-stringify-pretty-compact';
import * as monaco from 'monaco-editor';
import * as YAML from 'js-yaml';

import { EditorPropTypes } from '../index';
import { Mode, MONACO_SCHEMAS, THEMES, THEME_NAMES, DEFAULT_OPTIONS } from './consts';
import { renderInitialSpecText, parseSpecText, applyTheme, dumpSpecText } from './helpers';

// Add Schema supports
const monacoDiagnostics = {
  allowComments: false,
  enableSchemaRequest: false,
  validate: true,
  schemas: MONACO_SCHEMAS,
};

const jsonFormatter = {
  provideDocumentFormattingEdits(model) {
    return [
      {
        range: model.getFullModelRange(),
        text: stringify(JSON.parse(model.getValue())),
      },
    ];
  },
};

const yamlFormatter = {
  provideDocumentFormattingEdits(model) {
    return [
      {
        range: model.getFullModelRange(),
        text: YAML.safeDump(YAML.safeLoads(model.getValue())),
      },
    ];
  },
};

/**
 * Add additional language support for Monaco editor
 */
function setupEditor() {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions(monacoDiagnostics);
  monaco.languages.registerDocumentFormattingEditProvider('json', jsonFormatter);
  monaco.languages.registerDocumentFormattingEditProvider('yaml', yamlFormatter);
}

export default class VegaEditor extends React.Component {
  static propTypes = EditorPropTypes;

  constructor(props) {
    super(props);
    this.editor = null; // reference to the Monaco editor instance.
    this.state = { ...props.options };
    this.buffers = {}; // Editor model buffer based on lang & mode
    this.updateSpec = this.updateSpec.bind(this);
    this.updateLang = this.updateLang.bind(this);
    this.updateTheme = this.updateTheme.bind(this);
    this.updateEditorBuffer = this.updateEditorBuffer.bind(this);
    this.editorDidMount = this.editorDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
  }

  componentWillUnmount() {
    Object.values(this.buffers).forEach(buf => buf.model.dispose());
  }

  getEditorBuffer(targetState) {
    const { spec, lang, mode, theme } = { ...this.state, ...targetState };
    const { lang: origLang, mode: origMode } = this.state;
    const uri = `internal://server/${mode}.${lang}`;
    const bufs = this.buffers;
    let model = monaco.editor.getModel(uri);
    if (!model) {
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
      model = monaco.editor.createModel(initialValue, lang, uri);
    }
    bufs[uri] = bufs[uri] || { model, viewState: null };
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
    const curModel = editor.getModel();
    if (curModel === newBuf.model) {
      return;
    }
    if (curModel) {
      this.buffers[curModel.uri].viewState = editor.saveViewState();
    }
    editor.setModel(newBuf.model);
    if (newBuf.viewState) {
      editor.restoreViewState(newBuf.viewState);
    }
    // the updated spec from the new model
    targetState.spec = newBuf.model.getValue();
    // once language/mode changed, get editor content and use as current spec
    this.setOption(targetState);
  }

  editorDidMount(editor) {
    this.editor = editor;
    this.updateEditorBuffer();
  }

  render() {
    const { lang, mode, spec, theme: _theme } = this.state;
    const monacoOptions = {
      model: null,
      automaticLayout: true,
      folding: true,
      minimap: { enabled: false },
      readOnly: false,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      fontSize: '13px',
    };
    // make sure theme is acceptable value
    const theme = THEMES.includes(_theme) ? _theme : DEFAULT_OPTIONS.theme;

    return (
      <div className="vega-spec-editor">
        <Form.Item>
          <Select style={{ width: '7em' }} value={lang} onChange={target => this.updateLang(target)}>
            <Select.Option key="yaml"> YAML </Select.Option>
            <Select.Option key="json"> JSON </Select.Option>
          </Select>
          <Select style={{ width: '8em' }} value={mode} onChange={target => this.updateMode(target)}>
            <Select.Option key={Mode.Vega}> Vega </Select.Option>
            <Select.Option key={Mode.VegaLite}> Vega Lite </Select.Option>
          </Select>
          <Select
            style={{ width: '14em' }}
            defaultValue="custom"
            value={theme}
            onChange={target => this.updateTheme(target)}
          >
            {THEMES.map(value => (
              <Select.Option key={value}> {THEME_NAMES[value]} </Select.Option>
            ))}
          </Select>
          <a className="vega-help-link" href="https://vega.github.io/vega-lite/" target="_blank" rel="noopener noreferrer">
            <Icon type="question-circle" /> What is Vega?
          </a>
        </Form.Item>
        <MonacoEditor
          height="55vh" // 55% viewport height
          theme="vs-light"
          value={spec}
          options={monacoOptions}
          onChange={debounce(this.updateSpec, 1000)}
          editorWillMount={setupEditor}
          editorDidMount={this.editorDidMount}
        />
      </div>
    );
  }
}
