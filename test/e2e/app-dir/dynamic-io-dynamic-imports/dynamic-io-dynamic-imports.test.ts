import { nextTestSetup } from 'e2e-utils'

describe('async imports in dynamicIO', () => {
  const { next, isNextStart } = nextTestSetup({
    files: __dirname,
  })

  if (isNextStart) {
    it('does not cause any routes to become dynamic', async () => {
      const prerenderManifest = JSON.parse(
        await next.readFile('.next/prerender-manifest.json')
      )
      let prerenderedRoutes = Object.keys(prerenderManifest.routes).sort()
      expect(prerenderedRoutes).toEqual([
        '/inside-client-component/async-module',
        '/inside-client-component/sync-module',
        '/inside-component/async-module',
        '/inside-component/from-node-modules/cjs/sync-module',
        '/inside-component/from-node-modules/esm/async-module',
        '/inside-component/from-node-modules/esm/sync-module',
        '/inside-component/sync-module',
        '/inside-route-handler/async-module',
        '/inside-route-handler/sync-module',
      ])
    })
  }

  describe('inside a server component', () => {
    it('import of a sync module', async () => {
      const browser = await next.browser('/inside-component/sync-module')
      expect(await browser.elementByCss('body').text()).toBe('hello')
    })

    it('import of module with top-level-await', async () => {
      const browser = await next.browser('/inside-component/async-module')
      expect(await browser.elementByCss('body').text()).toBe('hello')
    })

    describe('dynamic import in node_modules', () => {
      describe('in an ESM package', () => {
        it('import of a sync module', async () => {
          const browser = await next.browser(
            '/inside-component/from-node-modules/esm/sync-module'
          )
          expect(await browser.elementByCss('body').text()).toBe('hello')
        })

        it('import of module with top-level-await', async () => {
          const browser = await next.browser(
            '/inside-component/from-node-modules/esm/async-module'
          )
          expect(await browser.elementByCss('body').text()).toBe('hello')
        })
      })

      describe('in a CJS package', () => {
        // CJS can't do top-level-await, so we're only testing sync modules
        it('import of a sync module', async () => {
          const browser = await next.browser(
            '/inside-component/from-node-modules/cjs/sync-module'
          )
          expect(await browser.elementByCss('body').text()).toBe('hello')
        })
      })
    })
  })

  describe('inside a client component', () => {
    it('import of a sync module', async () => {
      const browser = await next.browser('/inside-client-component/sync-module')
      expect(await browser.elementByCss('body').text()).toBe('hello')
    })

    it('import of module with top-level-await', async () => {
      const browser = await next.browser(
        '/inside-client-component/async-module'
      )
      expect(await browser.elementByCss('body').text()).toBe('hello')
    })
  })

  describe('inside a GET route handler', () => {
    it('import of a sync module', async () => {
      const result = await next
        .fetch('/inside-route-handler/sync-module')
        .then((res) => res.text())
      expect(result).toBe('hello')
    })

    it('import of module with top-level-await', async () => {
      const result = await next
        .fetch('/inside-route-handler/async-module')
        .then((res) => res.text())
      expect(result).toBe('hello')
    })
  })

  describe('unawaited at the top level', () => {
    it('import of a sync module', async () => {
      const browser = await next.browser('/top-level/sync-module')
      expect(await browser.elementByCss('body').text()).toBe('hello')
    })

    it('import of module with top-level-await', async () => {
      const browser = await next.browser('/top-level/async-module')
      expect(await browser.elementByCss('body').text()).toBe('hello')
    })
  })

  // TODO:
  // - depending on a shared async module (rn they're all isolated)
  // - imports inside an external
  // - imports in a prerendered GET handler
  // likely to fail:
  // - unawaited import with a tasky delay (and nothing else to delay `cacheSignal`)
  // - TLA in a client component that is not a segment and is only imported from server components (so it's missed by `warmAllModulesInTree`)
})
