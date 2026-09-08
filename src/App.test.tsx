import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clearStoredState } from './db'
import { createInitialState, createWorkout } from './program'
import App, { completeActiveWorkout } from './App'

describe('app workflow', () => {
  beforeEach(async () => {
    await clearStoredState()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('starts the personalized Workout A and records a set', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Competition' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /start workout/i }))
    expect(await screen.findByRole('heading', { name: 'Squat + bench strength' })).toBeInTheDocument()
    expect(screen.getByLabelText('Back Squat working weight')).toHaveValue(205)
    await user.click(screen.getByRole('button', { name: 'Complete Back Squat set 1' }))
    expect(screen.getByText('RESTING')).toBeInTheDocument()
    expect(screen.getByText(/1\/22 work/)).toBeInTheDocument()
  })

  it('auto-collapses a completed exercise and lets the user expand it again', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })
    await user.click(screen.getByRole('button', { name: /start workout/i }))

    for (let set = 1; set <= 5; set += 1) {
      await user.click(screen.getByRole('button', { name: `Complete Back Squat set ${set}` }))
    }

    const expand = await screen.findByRole('button', { name: 'Expand Back Squat' })
    expect(screen.queryByLabelText('Back Squat working weight')).not.toBeInTheDocument()
    expect(screen.getByText('5/5 working sets complete')).toBeInTheDocument()

    await user.click(expand)
    expect(screen.getByLabelText('Back Squat working weight')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse Back Squat' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows total lifted volume after finishing and includes completed warm-ups', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })
    await user.click(screen.getByRole('button', { name: /start workout/i }))
    await user.click(screen.getByRole('button', { name: 'Complete Back Squat warm-up 1' }))
    await user.click(screen.getByRole('button', { name: 'Complete Back Squat set 1' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    expect(await screen.findByText('WORKOUT COMPLETE')).toBeInTheDocument()
    expect(screen.getAllByText('1,385 lb').length).toBeGreaterThan(0)
    expect(screen.getByText('Working sets + completed warm-ups')).toBeInTheDocument()
  })

  it('shows the supplied bodyweight in settings', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await waitFor(() => expect(screen.getByDisplayValue('150')).toBeInTheDocument())
  })

  it('preserves fractional microplates when editing the plate list', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const plates = screen.getByLabelText('Available plates')
    await user.clear(plates)
    await user.type(plates, '1.25, 45')
    await user.tab()
    await waitFor(() => expect(plates).toHaveValue('45, 1.25'))
  })

  it('completes A/B/C in order and rotates the B bench variation weekly', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })

    const finishCurrentWorkout = async () => {
      screen.getAllByRole('button', { name: /^Complete .+ set \d+$/ }).forEach((button) => fireEvent.click(button))
      await user.click(screen.getByRole('button', { name: 'Finish' }))
      await user.click(screen.getByRole('button', { name: /Done/ }))
    }

    await user.click(screen.getByRole('button', { name: /start workout/i }))
    await finishCurrentWorkout()
    expect(await screen.findByRole('heading', { name: 'Deadlift + upper' })).toBeInTheDocument()
    expect(screen.getByText('Feet-up Bench Press')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start workout/i }))
    await finishCurrentWorkout()
    expect(await screen.findByRole('heading', { name: 'Paused technique' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start workout/i }))
    await finishCurrentWorkout()
    expect(await screen.findByRole('heading', { name: 'Competition' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start workout/i }))
    await finishCurrentWorkout()
    expect(await screen.findByRole('heading', { name: 'Deadlift + upper' })).toBeInTheDocument()
    expect(screen.getByText('Incline Bench Press')).toBeInTheDocument()
  })

  it('switches to Texas Method without deleting the personal plan state', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })
    await user.click(screen.getByRole('button', { name: 'Plan' }))
    expect(await screen.findByRole('heading', { name: 'Choose your method' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Texas Method/ }))
    await user.click(screen.getByRole('button', { name: /Use this program/ }))
    expect(await screen.findByRole('heading', { name: 'Volume Day' })).toBeInTheDocument()
    expect(screen.getByText('Texas')).toBeInTheDocument()
    expect(screen.getByText(/up to 185 lb/)).toBeInTheDocument()
  })

  it('creates and activates an editable custom plan', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })
    await user.click(screen.getByRole('button', { name: 'Plan' }))
    await user.click(screen.getByRole('button', { name: /Build a program/ }))
    const name = screen.getByLabelText('Program name')
    await user.clear(name)
    await user.type(name, 'Meet Prep')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Choose your method' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Meet Prep' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Use this program/ }))
    expect(await screen.findByText('Meet Prep')).toBeInTheDocument()
  })

  it('bounds custom set counts and configures timed exercises in seconds', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Competition' })
    await user.click(screen.getByRole('button', { name: 'Plan' }))
    await user.click(screen.getByRole('button', { name: /Build a program/ }))

    const firstExercise = screen.getByLabelText('Workout A exercise 1')
    const row = firstExercise.closest<HTMLElement>('.builder-exercise')!
    fireEvent.change(within(row).getByRole('spinbutton', { name: 'Sets' }), { target: { value: '999999' } })
    expect(within(row).getByRole('spinbutton', { name: 'Sets' })).toHaveValue(10)
    await user.selectOptions(firstExercise, 'plank')
    expect(within(row).getByRole('spinbutton', { name: 'Seconds' })).toHaveValue(45)
  })

  it('automatically requests persistent storage only once', async () => {
    const originalStorage = navigator.storage
    const persist = vi.fn().mockResolvedValue(false)
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: vi.fn().mockResolvedValue(false), persist } })
    try {
      const user = userEvent.setup()
      render(<App />)
      await screen.findByRole('heading', { name: 'Competition' })

      await user.click(screen.getByRole('button', { name: /start workout/i }))
      await user.click(screen.getByRole('button', { name: 'Finish' }))
      await user.click(screen.getByRole('button', { name: /Done/ }))
      await screen.findByRole('heading', { name: 'Deadlift + upper' })

      await user.click(screen.getByRole('button', { name: /start workout/i }))
      await user.click(screen.getByRole('button', { name: 'Finish' }))
      await user.click(screen.getByRole('button', { name: /Done/ }))
      await screen.findByRole('heading', { name: 'Paused technique' })

      await waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
    } finally {
      Object.defineProperty(navigator, 'storage', { configurable: true, value: originalStorage })
    }
  })

  it('persists an edited 5/3/1 training max when finishing', () => {
    const state = createInitialState()
    state.activeProgramId = '531-rolling'
    state.activeSession = createWorkout(state)
    const squat = state.activeSession.exercises[0]
    squat.baseWeightLb = 300
    squat.sets.forEach((set) => { set.weightLb = 300 })

    const completed = completeActiveWorkout(state, new Date('2026-09-07T17:00:00.000Z'))
    expect(completed.programStates['531-rolling'].progress.squat.workingWeightLb).toBe(300)
  })
})
