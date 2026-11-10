import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Avatar } from './Avatar'

/** T-63: an avatar never adds its own words to the name of what holds it. */
describe('Avatar', () => {
  afterEach(cleanup)

  it('hides the initials fallback from screen readers', () => {
    render(
      <button type="button">
        <Avatar name="Jamie Oakley" userId="user-001" />
        Jamie Oakley
      </button>,
    )
    expect(screen.getByText('JO')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button')).toHaveAccessibleName('Jamie Oakley')
  })

  it('falls back to hidden initials when the photo fails', () => {
    const { container } = render(
      <button type="button">
        <Avatar name="Jamie Oakley" userId="user-001" src="https://example.test/broken.jpg" />
        Jamie Oakley
      </button>,
    )
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('JO')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button')).toHaveAccessibleName('Jamie Oakley')
  })

  it('treats a loaded photo as decoration, so the name is not read twice', () => {
    render(
      <button type="button">
        <Avatar name="Jamie Oakley" userId="user-001" src="https://example.test/jamie.jpg" />
        Jamie Oakley
      </button>,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName('Jamie Oakley')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
