import { describe, it, expect, beforeEach } from 'vitest';
import {
  findThreadListContainer,
  hasStructuralMutation,
} from '../../src/preload/thread-list.js';
import { THREAD_LIST_MAX_PARENT_WALK } from '../../src/shared/constants.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('findThreadListContainer (TSC-A20..A22)', () => {
  it('returns null when no thread links exist (TSC-A20)', () => {
    document.body.innerHTML = '<div><a href="/explore/">not a thread</a></div>';
    expect(findThreadListContainer(document)).toBeNull();
  });

  it('returns the ancestor containing ≥2 thread links (TSC-A22)', () => {
    document.body.innerHTML = `
      <main>
        <aside id="thread-list">
          <div class="row"><a href="/direct/t/aaa">A</a></div>
          <div class="row"><a href="/direct/t/bbb">B</a></div>
          <div class="row"><a href="/direct/t/ccc">C</a></div>
        </aside>
      </main>
    `;
    const container = findThreadListContainer(document);
    expect(container).not.toBeNull();
    expect(container?.id).toBe('thread-list');
  });

  it('returns firstLink.parentElement as a fallback when no ≥2-link ancestor exists within bounds (TSC-A21)', () => {
    document.body.innerHTML = `
      <section>
        <div id="lonely">
          <a href="/direct/t/xxx">X</a>
        </div>
      </section>
    `;
    const container = findThreadListContainer(document);
    expect(container).not.toBeNull();
    expect(container?.id).toBe('lonely');
  });

  it('walks at most THREAD_LIST_MAX_PARENT_WALK ancestors (TSC-A21)', () => {
    // Build a chain deeper than the walk limit with no intermediate ancestor
    // holding ≥2 links. An ancestor outside the walk bound DOES have ≥2 links
    // (body qualifies because of the extra link at the bottom). If the walk
    // cap is honored, we fall back to firstLink.parentElement (`wrap-0`); if
    // the cap is broken, the walk reaches body and returns body instead.
    let html = '<a id="target" href="/direct/t/one">one</a>';
    for (let i = 0; i < THREAD_LIST_MAX_PARENT_WALK + 5; i++) {
      html = `<div class="wrap-${i}">${html}</div>`;
    }
    // Second thread link at body level so body has ≥2 — a broken cap would
    // return <body>.
    html += '<a href="/direct/t/two">two</a>';
    document.body.innerHTML = html;

    const container = findThreadListContainer(document);
    expect(container).not.toBeNull();
    // Cap honored → fallback to firstLink.parentElement (`wrap-0`).
    expect(container?.classList.contains('wrap-0')).toBe(true);
    // Cap broken → we'd get <body> instead. Assert explicitly so a regression
    // that removes the cap is loud.
    expect(container?.tagName).not.toBe('BODY');
    expect(container).not.toBe(document.body);
  });

  it('accepts an Element root (not just Document)', () => {
    const scope = document.createElement('section');
    scope.innerHTML = `
      <div id="inner-list">
        <a href="/direct/t/111">1</a>
        <a href="/direct/t/222">2</a>
      </div>
    `;
    document.body.appendChild(scope);
    const container = findThreadListContainer(scope);
    expect(container?.id).toBe('inner-list');
  });
});

describe('hasStructuralMutation', () => {
  function makeMutation(overrides: Partial<MutationRecord>): MutationRecord {
    return {
      type: 'childList',
      target: document.body,
      addedNodes: [] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      previousSibling: null,
      nextSibling: null,
      attributeName: null,
      attributeNamespace: null,
      oldValue: null,
      ...overrides,
    } as MutationRecord;
  }

  it('returns true when childList mutation has added nodes', () => {
    const added = [document.createElement('div')] as unknown as NodeList;
    expect(hasStructuralMutation([makeMutation({ addedNodes: added })])).toBe(true);
  });

  it('returns true when childList mutation has removed nodes', () => {
    const removed = [document.createElement('div')] as unknown as NodeList;
    expect(hasStructuralMutation([makeMutation({ removedNodes: removed })])).toBe(true);
  });

  it('returns false for characterData-only mutations', () => {
    expect(
      hasStructuralMutation([
        makeMutation({ type: 'characterData' as MutationRecordType }),
      ]),
    ).toBe(false);
  });

  it('returns false for empty childList mutations', () => {
    expect(hasStructuralMutation([makeMutation({})])).toBe(false);
  });
});
