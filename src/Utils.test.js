import { isEmpty } from "./Utils"

test('isEmpty', () => {
    expect(isEmpty({})).toBe(true)
    expect(isEmpty({a: 1})).toBe(false)
});