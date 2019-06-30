/**
 * Common definition of the rich text editor
 * (currently using Ace Editor, potentially migrating to Monaco)
 */
import ace from 'brace';

import 'brace/ext/language_tools';
import 'brace/mode/json';
import 'brace/mode/python';
import 'brace/mode/sql';
import 'brace/mode/yaml';
import 'brace/theme/textmate';
import 'brace/ext/searchbox';

defineDummySnippets('python');
defineDummySnippets('sql');
defineDummySnippets('json');
defineDummySnippets('yaml');

// By default Ace will try to load snippet files for the different modes and fail.
// We don't need them, so we use these placeholders until we define our own.
export function defineDummySnippets(mode, fn) {
  ace.define(
    `ace/snippets/${mode}`,
    ['require', 'exports', 'module'],
    fn ||
      ((require, exports) => {
        exports.snippetText = '';
        exports.scope = mode;
      }),
  );
}
export const langTools = ace.acequire('ace/ext/language_tools');
export const snippetManager = ace.acequire('ace/snippets').snippetManager;
