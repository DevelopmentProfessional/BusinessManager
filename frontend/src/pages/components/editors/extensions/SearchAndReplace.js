import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const searchPluginKey = new PluginKey('searchAndReplace');

function findMatches(doc, searchTerm, caseSensitive = false) {
  if (!searchTerm) return [];

  const results = [];
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let index = text.indexOf(term);
    while (index !== -1) {
      results.push({
        from: pos + index,
        to: pos + index + searchTerm.length,
      });
      index = text.indexOf(term, index + 1);
    }
  });

  return results;
}

/**
 * SearchAndReplace extension for Tiptap.
 * Uses ProseMirror decorations to highlight matches.
 */
export const SearchAndReplace = Extension.create({
  name: 'searchAndReplace',

  addOptions() {
    return {
      searchClass: 'search-result',
      activeClass: 'search-result-active',
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [],
      currentIndex: 0,
      caseSensitive: false,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDecorations, oldState, newState) {
            const { searchTerm, caseSensitive, currentIndex } = extension.storage;
            if (!searchTerm) return DecorationSet.empty;

            const results = findMatches(newState.doc, searchTerm, caseSensitive);
            extension.storage.results = results;

            const decorations = results.map((result, i) => {
              const className =
                i === currentIndex
                  ? `${extension.options.searchClass} ${extension.options.activeClass}`
                  : extension.options.searchClass;
              return Decoration.inline(result.from, result.to, {
                class: className,
              });
            });

            return DecorationSet.create(newState.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearchTerm:
        (term) =>
        ({ editor }) => {
          this.storage.searchTerm = term;
          this.storage.currentIndex = 0;
          // Force plugin to re-evaluate decorations
          editor.view.dispatch(editor.state.tr);
          return true;
        },

      nextSearchResult:
        () =>
        ({ editor }) => {
          const { results } = this.storage;
          if (results.length === 0) return false;
          this.storage.currentIndex = (this.storage.currentIndex + 1) % results.length;
          editor.view.dispatch(editor.state.tr);
          // Scroll to match
          const match = results[this.storage.currentIndex];
          if (match) {
            editor.commands.setTextSelection(match.from);
            // scrollIntoView via the editor's built-in method
            editor.commands.scrollIntoView();
          }
          return true;
        },

      prevSearchResult:
        () =>
        ({ editor }) => {
          const { results } = this.storage;
          if (results.length === 0) return false;
          this.storage.currentIndex =
            (this.storage.currentIndex - 1 + results.length) % results.length;
          editor.view.dispatch(editor.state.tr);
          const match = results[this.storage.currentIndex];
          if (match) {
            editor.commands.setTextSelection(match.from);
            editor.commands.scrollIntoView();
          }
          return true;
        },

      replaceCurrentResult:
        () =>
        ({ editor }) => {
          const { results, currentIndex, replaceTerm } = this.storage;
          if (results.length === 0) return false;
          const match = results[currentIndex];
          if (!match) return false;

          editor
            .chain()
            .focus()
            .setTextSelection({ from: match.from, to: match.to })
            .insertContent(replaceTerm)
            .run();

          // Clamp currentIndex so it doesn't exceed new results length
          const newResults = this.storage.results;
          if (this.storage.currentIndex >= newResults.length && newResults.length > 0) {
            this.storage.currentIndex = newResults.length - 1;
          } else if (newResults.length === 0) {
            this.storage.currentIndex = 0;
          }

          // Re-trigger search decorations
          editor.view.dispatch(editor.state.tr);
          return true;
        },

      replaceAllResults:
        () =>
        ({ editor }) => {
          const { searchTerm, replaceTerm, caseSensitive } = this.storage;
          if (!searchTerm) return false;

          const { doc } = editor.state;
          const results = findMatches(doc, searchTerm, caseSensitive);
          if (results.length === 0) return false;

          // Replace from end to start so positions remain valid
          const chain = editor.chain().focus();
          for (let i = results.length - 1; i >= 0; i--) {
            chain
              .setTextSelection({ from: results[i].from, to: results[i].to })
              .insertContent(replaceTerm);
          }
          chain.run();

          this.storage.results = [];
          this.storage.currentIndex = 0;
          editor.view.dispatch(editor.state.tr);
          return true;
        },

      clearSearch:
        () =>
        ({ editor }) => {
          this.storage.searchTerm = '';
          this.storage.replaceTerm = '';
          this.storage.results = [];
          this.storage.currentIndex = 0;
          editor.view.dispatch(editor.state.tr);
          return true;
        },

      setReplaceTerm:
        (term) =>
        () => {
          this.storage.replaceTerm = term;
          return true;
        },

      setSearchCaseSensitive:
        (value) =>
        ({ editor }) => {
          this.storage.caseSensitive = value;
          editor.view.dispatch(editor.state.tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        // This is handled by the toolbar to show the find panel
        // We just prevent the browser's default find
        return true;
      },
    };
  },
});

export default SearchAndReplace;
