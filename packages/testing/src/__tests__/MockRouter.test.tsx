import React from 'react'
import { Route, Private } from '@redwoodjs/router'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'

import { routes, Router } from '../MockRouter'

const FakePage = () => <></>

describe('MockRouter', () => {
  it('should correctly map routes', () => {
    render(
      <Router>
        <Route name="a" path="/a" page={<FakePage />} />
        <Route name="b" path="/b" page={<FakePage />} />
        <Private unauthenticated="a">
          <Route name="c" path="/c" page={<FakePage />} />
          <Route name="d" path="/d" page={<FakePage />} />
        </Private>
      </Router>
    )

    expect(Object.keys(routes)).toEqual(
      expect.arrayContaining(['a', 'b', 'c', 'd'])
    )
  })
})
