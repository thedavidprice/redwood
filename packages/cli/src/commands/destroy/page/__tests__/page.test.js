global.__dirname = __dirname
jest.mock('fs')
jest.mock('src/lib', () => {
  return {
    ...jest.requireActual('src/lib'),
    generateTemplate: () => '',
  }
})

import fs from 'fs'

import 'src/lib/test'
import { getPaths } from 'src/lib'

import { files } from '../../../generate/page/page'
import { tasks } from '../page'

beforeEach(() => {
  fs.__setMockFiles({
    ...files({ name: 'About' }),
    [getPaths().web.routes]: [
      '<Routes>',
      '  <Route path="/about" page={AboutPage} name="about" />',
      '  <Route path="/" page={HomePage} name="home" />',
      '  <Route notfound page={NotFoundPage} />',
      '</Routes>',
    ].join('\n'),
  })
})

afterEach(() => {
  fs.__setMockFiles({})
  jest.spyOn(fs, 'unlinkSync').mockClear()
})

test('destroys page files', async () => {
  const unlinkSpy = jest.spyOn(fs, 'unlinkSync')
  const t = tasks({ name: 'About' })
  t.setRenderer('silent')

  return t._tasks[0].run().then(() => {
    const generatedFiles = Object.keys(files({ name: 'About' }))
    expect(generatedFiles.length).toEqual(unlinkSpy.mock.calls.length)
    generatedFiles.forEach((f) => expect(unlinkSpy).toHaveBeenCalledWith(f))
  })
})

test('cleans up route from Routes.js', async () => {
  const t = tasks({ name: 'About' })
  t.setRenderer('silent')

  return t._tasks[1].run().then(() => {
    const routes = fs.readFileSync(getPaths().web.routes)
    expect(routes).toEqual(
      [
        '<Routes>',
        '  <Route path="/" page={HomePage} name="home" />',
        '  <Route notfound page={NotFoundPage} />',
        '</Routes>',
      ].join('\n')
    )
  })
})

test('cleans up route with a custom path from Routes.js', async () => {
  const t = tasks({ name: 'About', path: '/about-us' })
  t.setRenderer('silent')

  return t._tasks[1].run().then(() => {
    const routes = fs.readFileSync(getPaths().web.routes)
    expect(routes).toEqual(
      [
        '<Routes>',
        '  <Route path="/" page={HomePage} name="home" />',
        '  <Route notfound page={NotFoundPage} />',
        '</Routes>',
      ].join('\n')
    )
  })
})
