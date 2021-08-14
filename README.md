# Vue i18n mini

This package provides a minimalistic (but complete), very lightweight,
easy-to-use i18n solution for Vue 3.

For companion library, see [Express i18n mini](https://github.com/plashenkov/express-i18n-mini)

## Features

- Lightweight
- Uses lodash template for string interpolation

## Installation

```bash
npm i vue-i18n-mini
```

## Usage

Usually you may want to use i18n according to the following scenarios:

1. A language prefix in URL defines the current language.
   For example, this is the front site where SEO / SSR are desired.
   No prefix means either the default language or we must find the best
   possible language and redirect the user to it.

2. We do not use language prefix in URLs, but define the best possible language taking
   into account the browser option (browsers have languages ordered by preference option).
   Additionally to this, we can provide to an end user the ability to choose and save
   the different language from our list. In this case, we can store this preference, say,
   in cookie or in localStorage.

3. The current language may _initially_ be defined taking into account the browser option
   (as in the previous scenario), but most of the time we rely on the profile option
   of a logged in user. It is usually stored on the server (although it can be cached
   on the browser side, of course).

Some combinations of the above are possible: for example, the part of our site uses the first
scheme (language prefix in URL), and the other part uses the second scheme (user private zone,
where no URL prefix is required).

*Vue i18n mini* tries to cover all these use-cases.
Let's take a look at how to use it in practice.

### Configure

```js
// i18n.js

import {createI18n} from 'vue-i18n-mini'

const i18n = createI18n({
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

The `defaultLang` and `langData` options are required.

The `defaultLang` will be used if finding the best language for the user has failed.
Also, [when using router](),
you can omit the language prefix in URL for the default language.

If some message was not found in the current language, it will try to find it in `fallbackLang`.
If no `fallbackLang` is specified


Now, plug it in:

```js
// app.js

import {createApp} from 'vue'
import {i18n} from './i18n'

createApp(...)
  .use(i18n)
  .mount('#app')
```

Initialize it somewhere. This will analyze user preferred language and will pick up the most
suitable from available ones.

```js
i18n.init()
```

## License

This package is licensed under the [MIT license](LICENSE.md).
