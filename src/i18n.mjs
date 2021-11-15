import {resolveComponent, h, ref, computed, inject} from 'vue'
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

function acceptLanguageToArray(str) {
  if (!str) return []
  return str.toString()
    .split(',')
    .map(el => el.split(';'))
    .map(el => [el[0], el[1] && parseFloat(el[1].split('=')[1]) || 1])
    .sort((a, b) => b[1] - a[1])
    .map(el => el[0])
}

const injectKey = Symbol()

export function createI18n(options) {
  options = merge({
    langData: null,
    defaultLang: null,
    fallbackLang: null,
    store: null,
    routerOptions: {
      prefixParam: 'lang',
      prefixForDefaultLang: true,
      trailingSlashes: null, // 'always' | 'none' | 'prefix' | null
      notFoundRouteName: /not.*found/i,
    },
    lodashTemplateOptions: {
      interpolate: /{([\s\S]+?)}/g,
      escape: /{{([\s\S]+?)}}/g,
      evaluate: null,
    }
  }, options)

  if (!options.langData) {
    throw new Error('i18n: please define options.langData')
  }

  if (!options.defaultLang) {
    throw new Error('i18n: please define options.defaultLang')
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

  const ro = options.routerOptions
  const supportedLangs = Object.keys(options.langData)
  const langData = {}
  const langTemplates = {}
  const notFoundRouteNames = Array.isArray(ro.notFoundRouteName)
    ? ro.notFoundRouteName
    : [ro.notFoundRouteName]

  function isNotFound(name) {
    return notFoundRouteNames.some(el => el instanceof RegExp ? el.test(name) : el === name)
  }

  function langSupported(lang) {
    if (!lang) return false
    lang = lang.toLowerCase()
    return supportedLangs.find(el => el.toLowerCase() === lang) || false
  }

  function ensureLangSupported(lang) {
    const found = langSupported(lang)
    if (found) return found
    throw new Error(`i18n: language "${lang}" is not supported`)
  }

  async function loadLangData(lang) {
    if (langData[lang] !== undefined) return
    langData[lang] = null
    const data = options.langData[lang]
    const obj = await Promise.resolve(typeof data === 'function' ? data() : data)
    langData[lang] = (obj && (obj.__esModule || obj[Symbol.toStringTag] === 'Module')) ? obj.default : obj
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

  function routePrefix(langs, optional, children) {
    return {
      path: `/:${ro.prefixParam}(${langs.join('|')})` + (optional ? '?' : ''),
      children,
      component: {
        setup() {
          const c = resolveComponent('router-view')
          return () => h(c)
        }
      }
    }
  }

  function buildURL(prefix, path) {
    const slashes = ro.trailingSlashes
    const url = (prefix ? `/${prefix}/` : '/') + path.replace(/^\/+/, '')
    const urlNp = url.replace(/\/+$/, '')

    if (slashes == null) return url
    if (!slashes || slashes === 'none') return urlNp || '/'
    if (slashes === 'prefix') return url === `/${prefix}/` ? url : (urlNp || '/')
    return urlNp + '/'
  }

  return {
    async init(ctx = {}) {
      ctx = merge({
        isClient: true,
        request: null,
        redirect: null,
        writeResponse: null,
        router: null,
      }, ctx)

      let preferredLang
      let bestLang
      let setLangId = 0

      const lang = ref(null)
      const acceptLanguages = ctx.isClient
        ? navigator.languages || [navigator.language]
        : acceptLanguageToArray(ctx.request?.headers?.['accept-language'])

      async function savePreferred(lang) {
        preferredLang = lang
        return options.store?.save && await options.store.save(lang)
      }

      async function preferred() {
        if (preferredLang !== undefined) return preferredLang
        preferredLang = langSupported(options.store?.load && await options.store.load())
        return preferredLang
      }

      function best() {
        if (bestLang) return bestLang
        const langs = findBestLangs(acceptLanguages, supportedLangs)
        bestLang = langs.length ? langs[0] : options.defaultLang
        return bestLang
      }

      async function preferredOrBest() {
        return await preferred() || best()
      }

      const i18n = {
        get initialized() {
          return !!lang.value
        },

        get loadingLangs() {
          return Object.entries(langData).filter(l => l[1] === null).map(l => l[0])
        },

        t(id, data = null) {
          if (lang.value) return t(lang.value, id, data)
        },

        getLang() {
          return lang.value
        },

        async setLang(value, save = false) {
          value = ensureLangSupported(value)

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

        install(app) {
          app.config.globalProperties.$i18n = i18n
          app.config.globalProperties.$t = i18n.t
          app.provide(injectKey, i18n)
          app.component('I18nLink', {
            props: ['to', 'lang'],
            setup(props, ctx) {
              const ps = computed(() => {
                let {lang, ...ps} = props
                lang = lang ? ensureLangSupported(lang) : i18n.getLang()

                if (!ro.prefixForDefaultLang && lang === options.defaultLang) lang = ''

                if (typeof ps.to === 'string') ps.to = buildURL(lang, ps.to)
                else if (ps.to?.path !== undefined) ps.to.path = buildURL(lang, ps.to.path)
                else if (ps.to?.params) ps.to.params.lang = lang

                return ps
              })

              const c = resolveComponent('router-link')
              return () => h(c, ps.value, ctx.slots.default)
            }
          })
        }
      }

      if (ctx.router) {
        function redirect(url) {
          ctx.isClient || ctx.redirect?.(url, 302)
          return url
        }

        function notFound() {
          ctx.isClient || ctx.writeResponse?.({status: 404})
        }

        ctx.router.beforeEach(async to => {
          const path = to.fullPath
          const prefix = to.params[ro.prefixParam] && ensureLangSupported(to.params[ro.prefixParam])

          if (isNotFound(to.name)) {
            notFound()
          } else {
            if (!ro.prefixForDefaultLang && prefix === options.defaultLang) {
              const url = buildURL('', path.substring(options.defaultLang.length + 1))
              return redirect(url)
            }

            if (ro.prefixForDefaultLang && prefix === '') {
              const url = buildURL(await preferredOrBest(), path)
              return redirect(url)
            }

            const url = buildURL(prefix, prefix ? path.substring(prefix.length + 1) : path)
            if (url !== path) return redirect(url)
          }

          await i18n.setLang(prefix || (prefix === '' ? options.defaultLang : await preferredOrBest()))
        })
      } else {
        await i18n.setLang(await preferredOrBest())
      }

      return i18n
    },

    routePrefix(lang, children) {
      lang = ensureLangSupported(lang)
      return routePrefix([lang], lang === options.defaultLang, children)
    },

    universalRoutePrefix(children) {
      return routePrefix(supportedLangs, true, children)
    },
  }
}

export function useI18n() {
  return inject(injectKey)
}
