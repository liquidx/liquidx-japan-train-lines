import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';


import svelteConfig from "./svelte.config.js";

export default [
    js.configs.recommended,
    ...svelte.configs['flat/recommended'],
    prettier,
    ...svelte.configs['flat/prettier'],
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
    },
    {
        files: ["**/*.svelte", "**/*.svelte.js"],
        languageOptions: {
            parserOptions: {
                projectService: true,
                extraFileExtensions: [".svelte"],
                svelteConfig
            }
        }
    },
    {
        ignores: ['build/', '.svelte-kit/', 'dist/', 'data/', 'tests/', 'node_modules/']
    }
];
