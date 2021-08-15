import {resolveComponent, h, ref} from 'vue'
import template from 'lodash/template'
import merge from 'lodash/merge'
import get from 'lodash/get'
import cookie from 'js-cookie'

function findBestLangs(preferredLangs, supportedLangs) {
  const result = []

  supportedLangs.forEach((lang, i) => {
    let l = lang.toLowerCase()
    let p = l.split('-')[0]
    let w = 0
    let j = -1

    preferredLangs.forEach((lang, i) => {
      let pl = lang.toLowerCase()
      let pp = pl.split('-')[0]
      let pw

      if (pl === l) pw = 3
      else if (pp === l) pw = 2
      else if (pl === p) pw = 1
      else return

      if ((w - pw || j - i) < 0) {
        w = pw
        j = i
      }
    })

    w > 0 && result.push({l: lang, w, j, i})
  })

  return result
    .sort((a, b) => (b.w - a.w) || (a.j - b.j) || (a.i - b.i))
    .map(lang => lang.l)
}

export function createI18n(options) {
  options = merge({
    langData: null,
    defaultLang: null,
    fallbackLang: null,
    store: null,
    routerOptions: {
      prefixParam: 'lang',
      prefixForDefaultLang: true,
    },
    lodashTemplateOptions: {
      interpolate: /{([\s\S]+?)}/g,
      escape: /{{([\s\S]+?)}}/g,
      evaluate: null,
    }
  }, options)

  if (!options.langData) {
    throw new Error('Please define options.langData')
  }

  if (!options.defaultLang) {
    throw new Error('Please define options.defaultLang')
  }

  if (!options.store) {
    options.store = {
      async save(lang) {
        cookie.set('lang', lang, {expires: 365})
      },
      async load() {
        const lang = cookie.get('lang')
        lang && cookie.set('lang', lang, {expires: 365})
        return lang
      }
    }
  }

  const supportedLangs = Object.keys(options.langData)
  const langData = {}
  const langTemplates = {}
  const lang = ref(null)
  let initialized
  let preferredLang
  let bestLang
  let setLangId = 0

  function langSupported(lang) {
    return lang && supportedLangs.includes(lang)
  }

  function ensureLangSupported(lang) {
    if (!langSupported(lang)) {
      throw new Error(`Language "${lang}" is not supported`)
    }
  }

  async function loadLangData(lang) {
    if (langData[lang] !== undefined) return
    if (typeof options.langData[lang] === 'function') {
      langData[lang] = null
      const obj = await options.langData[lang]()
      langData[lang] = obj.__esModule || obj[Symbol.toStringTag] === 'Module' ? obj.default : obj
    } else {
      langData[lang] = options.langData[lang]
    }
  }

  function t(lang, id, data) {
    if (!lang || !langData[lang]) return

    if (langTemplates[lang + id]) {
      return langTemplates[lang + id](data)
    }

    const el = get(langData[lang], id)

    if (el === undefined && options.fallbackLang && lang !== options.fallbackLang) {
      return t(options.fallbackLang, id, data)
    }

    if (typeof el !== 'string' || !data) return el

    const f = langTemplates[lang + id] = template(el, {
      ...options.lodashTemplateOptions,
      imports: langData[lang]
    })

    return f(data)
  }

  async function savePreferred(lang) {
    preferredLang = lang

    return (
      options.store &&
      options.store.save &&
      await options.store.save(lang)
    )
  }

  async function preferred() {
    if (preferredLang !== undefined) {
      return preferredLang
    }

    preferredLang = (
      options.store &&
      options.store.load &&
      await options.store.load()
    )

    if (!langSupported(preferredLang)) {
      preferredLang = null
    }

    return preferredLang
  }

  function best() {
    if (bestLang) return bestLang
    const langs = findBestLangs(navigator.languages || [navigator.language], supportedLangs)
    bestLang = langs.length ? langs[0] : options.defaultLang
    return bestLang
  }

  async function preferredOrBest() {
    return await preferred() || best()
  }

  function routePrefix(langs, optional, children) {
    return {
      path: `/:${options.routerOptions.prefixParam}(${langs.join('|')})` + (optional ? '?' : ''),
      children,
      component: {
        setup() {
          const c = resolveComponent('router-view')
          return () => h(c)
        }
      }
    }
  }

  return {
    get initialized() {
      return !!lang.value
    },

    get loadingLangs() {
      return Object.entries(langData).filter(l => l[1] === null).map(l => l[0])
    },

    t(id, data = null) {
      if (lang.value) return t(lang.value, id, data)
    },

    get lang() {
      return lang.value
    },

    async setLang(value, save = false) {
      ensureLangSupported(value)

      save && savePreferred(value)

      if (lang.value === value) return

      const id = ++setLangId

      if (!options.fallbackLang || value === options.fallbackLang) {
        await loadLangData(value)
      } else {
        await Promise.all([loadLangData(options.fallbackLang), loadLangData(value)])
      }

      if (id === setLangId) {
        lang.value = value
      }
    },

    routePrefix(lang, children) {
      ensureLangSupported(lang)
      return routePrefix([lang], lang === options.defaultLang, children)
    },

    universalRoutePrefix(children) {
      return routePrefix(supportedLangs, true, children)
    },

    useRouter(router, navigateImmediately = true) {
      if (initialized) return
      initialized = true

      const prefixForDefaultLang = options.routerOptions.prefixForDefaultLang

      router.beforeEach(async to => {
        const langParam = to.params[options.routerOptions.prefixParam]

        if (!prefixForDefaultLang && langParam === options.defaultLang) {
          return to.fullPath.substring(options.defaultLang.length + 1)
        }

        if (prefixForDefaultLang && langParam === '') {
          return '/' + (await preferredOrBest()) + to.fullPath
        }

        const lang = langParam || (langParam === '' ? options.defaultLang : await preferredOrBest())
        navigateImmediately ? this.setLang(lang) : await this.setLang(lang)
      })
    },

    async init() {
      if (initialized) return
      initialized = true
      await this.setLang(await preferredOrBest())
    },

    install(app) {
      app.config.globalProperties.$i18n = this
      app.config.globalProperties.$t = this.t.bind(this)
    }
  }
}
