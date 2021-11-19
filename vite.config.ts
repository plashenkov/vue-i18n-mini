import {defineConfig} from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/i18n.ts',
      name: 'I18n',
      fileName: format => `i18n.${format}.js`
    },
    rollupOptions: {
      external: [
        'vue',
        'lodash/template',
        'lodash/merge',
        'lodash/get',
        'js-cookie'
      ],
      output: {
        globals: {
          'vue': 'Vue',
          'lodash/template': '_.template',
          'lodash/merge': '_.merge',
          'lodash/get': '_.get',
          'js-cookie': 'Cookies',
        }
      }
    }
  }
})
