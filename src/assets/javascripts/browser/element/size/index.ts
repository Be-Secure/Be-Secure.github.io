/* Placeholder for Copyright */

import {
  NEVER,
  Observable,
  Subject,
  defer,
  of
} from "rxjs"
import {
  filter,
  finalize,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap
} from "rxjs/operators"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Element offset
 */
export interface ElementSize {
  width: number                        /* Element width */
  height: number                       /* Element height */
}

/* ----------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

/**
 * Resize observer entry subject
 */
const entry$ = new Subject<ResizeObserverEntry>()

/**
 * Resize observer observable
 *
 * This observable will create a `ResizeObserver` on the first subscription
 * and will automatically terminate it when there are no more subscribers.
 * It's quite important to centralize observation in a single `ResizeObserver`,
 * as the performance difference can be quite dramatic, as the link shows.
 *
 * @see https://bit.ly/3iIYfEm - Google Groups on performance
 */
const observer$ = defer(() => of(
  new ResizeObserver(entries => {
    for (const entry of entries)
      entry$.next(entry)
  })
))
  .pipe(
    switchMap(resize => NEVER.pipe(startWith(resize))
      .pipe(
        finalize(() => resize.disconnect())
      )
    ),
    shareReplay(1)
  )

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Retrieve element size
 *
 * @param el - Element
 *
 * @returns Element size
 */
export function getElementSize(el: HTMLElement): ElementSize {
  return {
    width:  el.offsetWidth,
    height: el.offsetHeight
  }
}

/**
 * Retrieve element content size, i.e. including overflowing content
 *
 * @param el - Element
 *
 * @returns Element size
 */
export function getElementContentSize(el: HTMLElement): ElementSize {
  return {
    width:  el.scrollWidth,
    height: el.scrollHeight
  }
}

/* ------------------------------------------------------------------------- */

/**
 * Watch element size
 *
 * This function returns an observable that subscribes to a single internal
 * instance of `ResizeObserver` upon subscription, and emit resize events until
 * termination. Note that this function should not be called with the same
 * element twice, as the first unsubscription will terminate observation.
 *
 * Sadly, we can't use the `DOMRect` objects returned by the observer, because
 * we need the emitted values to be consistent with `getElementSize`, which will
 * return the used values (rounded) and not actual values (unrounded). Thus, we
 * use the `offset*` properties. See the linked GitHub issue.
 *
 * @see https://bit.ly/3m0k3he - GitHub issue
 *
 * @param el - Element
 *
 * @returns Element size observable
 */
export function watchElementSize(
  el: HTMLElement
): Observable<ElementSize> {
  return observer$
    .pipe(
      tap(observer => observer.observe(el)),
      switchMap(observer => entry$
        .pipe(
          filter(({ target }) => target === el),
          finalize(() => observer.unobserve(el)),
          map(() => getElementSize(el))
        )
      ),
      startWith(getElementSize(el))
    )
}
