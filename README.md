# Vue i18n mini

This package provides a minimalistic (but complete), very lightweight,
easy-to-use i18n solution for Vue 3.

For companion library, see
[Express i18n mini](https://github.com/plashenkov/express-i18n-mini)

## Features

- Lightweight
- Uses lodash template for string interpolation
- ...

## Installation

```bash
npm i vue-i18n-mini
```

## Usage

Usually you may want to use internationalization according to the following scenarios:

1. A language prefix in URL defines the current language:

   - https://example.com/en/
   - https://example.com/en-US/
   - https://example.com/de/

   This scenario is preferred, primarily, for the website where SEO is desired.
   No prefix means either the default language or a redirect to a URL with a prefix.

2. We do not use language prefixes in URLs here, instead the current language is always
   defined by browser's preference: the browser gives ordered list of preferred languages,
   so we use it to find the best suited language. Additionally to this, an end user
   usually can choose the different language from our list, and we store this preference,
   say, in cookie or in localStorage. Later we will use it first, and if it is not present,
   we will read browser's preference again.

3. The current language may _initially_ be defined based on the browser's preference
   (exactly as in the previous scenario), but actually we rely on a profile option
   of a logged in user. It is usually stored on the server (although it can be cached
   on the browser side, of course).

Some combinations of the above are possible: for example, the part of our site uses the first
scheme (language prefix in URL), and the other part uses the second scheme (user private zone,
where no URL prefix is required).

**Vue i18n mini** tries to cover all these use-cases.
Let's take a look at how to use it in practice.

### Configure

```js
import {createI18n} from 'vue-i18n-mini'

export const i18n = createI18n({
  defaultLang: 'en',
  fallbackLang: 'en',
  langData: {
    en: {
      hello: 'Hello {name}!'
    },
    de: {
      hello: 'Hallo {name}!'
    }
  }
})
```

The `defaultLang` and `langData` are the only required options.

The `defaultLang` will be used if no better languages available to meet user's preference.

The `fallbackLang` is a language to use if translations in the current language are not available.
If not set or null, such fallback does not occur.

`langData` contains all the available languages and messages. Actually, **it's recommended
to always lazy-load translations** instead of including them directly. In this case,
they will be loaded only when they are needed:

```js
import {createI18n} from 'vue-i18n-mini'

export const i18n = createI18n({
  defaultLang: 'en',
  fallbackLang: 'en',
  langData: {
    en: () => import('./locales/en'),
    de: () => import('./locales/de'),
  }
})
```

Now, plug it in:

```js
import {createApp} from 'vue'
import {i18n} from './i18n'

createApp(...)
  .use(i18n)
  .mount('#app')
```

Now, if you want to use language prefixes in URLs, use Vue router:

```js
import {createRouter} from 'vue-router'

const router = createRouter({
  // options...
})

i18n.useRouter(router)
```

**If you do not use router,** you need to initialize the library somewhere.
This will read user preferred (saved) language, or will try to find the best language
based on the browser's preference. As simple as that:

```js
i18n.init()
```

Alternatively, inside a component:

```js
export default {
  methods: {
    someMethod() {
      this.$i18n.init()
    }
  }
}
```

### Use

```vue
<template>
  <div>{{$t('hello', {name: 'World'})}}</div>
</template>
```

## License

This package is licensed under the [MIT license](LICENSE.md).
