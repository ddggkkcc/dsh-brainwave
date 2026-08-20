import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendStashItem,
  normalizeStashText,
  removeStashItem,
} from '../lib/host/operations.js'

const item = (id, text = id) => ({
  id,
  text,
  createdAt: 1,
  updatedAt: 1,
})

test('save normalizes surrounding whitespace and rejects blank text', () => {
  assert.equal(normalizeStashText('  hello  '), 'hello')
  assert.equal(normalizeStashText(' \n\t '), undefined)
})

test('append preserves existing items and supports the first insert', () => {
  const first = item('first')
  const second = item('second')
  assert.deepEqual(appendStashItem(undefined, first), [first])
  assert.deepEqual(appendStashItem([first], second), [first, second])
})

test('delete is idempotent and removes the row when its last item is deleted', () => {
  const first = item('first')
  const second = item('second')
  assert.deepEqual(removeStashItem([first, second], 'first'), [second])
  assert.equal(removeStashItem([first], 'first'), undefined)
  assert.deepEqual(removeStashItem([first], 'missing'), [first])
  assert.equal(removeStashItem(undefined, 'missing'), undefined)
})
