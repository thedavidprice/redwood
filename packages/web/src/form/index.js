export * from '@redwoodjs/forms'

/**
 * @deprecated Please import from "@redwoodjs/forms"
 */
export const Form = () => {
  console.warn(`
  Deprecation notice, forms have moved:
    'import { Form } from "@redwoodjs/web"' has moved.
    Please use:
    'import { Form } from "@redwoodjs/forms"' instead.
  `)
  return Form
}
