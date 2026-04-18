# Utils

Utility methods and interfaces to 3rd party utility libraries.

# Util Unit testing
## What is a Unit?

A "unit" will be defined as a `.js` file.
So each js file we test will have its own test file.
The unit test directory structure should mirror the application directory structure.
`test/unit/` should mirror `js/`

## When Writing a Test

- Unit tests should **test what** the module does and **not how** the module works / Unit tests should **describe behaviors and not implementations**.
- Unit tests should not have knowledge of how any other unit functions.
- Unit tests should test one method only. This allows you to easily identify what failed if the test fails.
- Unit tests should not be coupled together, therefore one unit test CANNOT rely on another unit test having completed first.

*These last two often clash, in which case it is often better to compromise on the first*

## What to Unit Test

**Test the public API only**

A private method is an implementation detail that should be hidden to the users of the class. Testing private methods breaks encapsulation.

In Pragmatic Unit Testing, Dave Thomas and Andy Hunt write:

> Most of the time, you should be able to test a class by exercising its public methods. If there is significant functionality that is hidden behind private or protected access, that might be a warning sign that there's another class in there struggling to get out.

**Use coverage reports** to monitor testing private APIs from the public interface.
Not being able to test a private method from a public interface indicates a problem with the code.

**Pure functions**

Modules may contain other utility functions not part of a class. Ideally these functions are pure containing no side effects.
These methods should be tested in isolation and exported from the module for testing, even if they are not exported otherwise.

## What Not to Unit Test

**We do not need to test the implementation of imported modules / 3rd party libraries.**

For instance if one of our methods accepts a `dayjs()` instance as an argument, we do not need to test that dayjs can handle various ranges of dates, only the values of dayjs that are relevant to the behavior of the function.

**We should limit DOM/view related testing.**

Whether a view's template displays the correct DOM, or whether the triggers/events work is more for integration testing than for unit testing. Most DOM/view related testing is mostly Marionette implementation.

**...however we may want to unit test portions of a View (even private ones).**

Particularly portions that are complicated such as an algorithm that decides which child view to display in a collection.

We also may want to test `templateContext` directly by mocking the `context` Marionette would give the function and testing the output.

```js
// where myTestObj is essentially the equivalent of _.clone(fooModel.attributes)
expect(_.bind(SomeView.prototype.templateHelpers, myTestObj)).to.deep.equal(myExpectedObj);
```

Even then we want to make sure we are not retesting another utility. For example we do not need to test `return someCount + _.pluralize('foo', someCount);` Testing this `templateContext` would essentially be testing an implementation of `_.pluralize` and little else.

## Testing Priorities

We should be testing the **business logic: how data can be created, displayed, stored, and changed**.

We should focus on testing:
- the lowest level units first; Those that other units rely on
- state logic
- pure functions
- units that take the least amount of mocks and stubs
- units that interact the least with the DOM/window

## Fixtures

Fixtures should be json files loaded in `test/fixtures/`.

They should be reusable and generic. Collections of models, specifically unique models should be defined in `collections/`.  One-off or special fixtures can be defined in the fixtures folder or similar related fixtures might be put in their own subdirectory such as `insights/`. Fixtures should not necessarily represent APIs, but be portions of APIs that can be composed together for testing. Modifications to the data such as adding a model to a collection or changing paricular values on a model should not break tests. Fixtures represent the portions of data needed for testing that are not part of the test directly.  Directly tested data should be stubbed specifically for the test and not stored in the fixture.

## Testing Tools

* [Mocha Test Framework](https://mochajs.org/)
* [Chai Assertion Library](https://github.com/chaijs/chai)
* [Chai jQuery plugin](http://chaijs.com/plugins/chai-jq/)
* [Sinon spies and stubs](https://github.com/sinonjs/sinon)
* [Sinon-Chai Assertions](https://github.com/domenic/sinon-chai)
