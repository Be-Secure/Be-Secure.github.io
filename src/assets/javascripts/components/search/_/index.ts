/* Placeholder for Copyright */

import { NEVER, Observable, ObservableInput, merge } from "rxjs"
import { filter, sample, take } from "rxjs/operators"

import { configuration } from "~/_"
import {
  Keyboard,
  getActiveElement,
  getElements,
  setElementFocus,
  setElementSelection,
  setToggle
} from "~/browser"
import {
  SearchIndex,
  isSearchQueryMessage,
  isSearchReadyMessage,
  setupSearchWorker
} from "~/integrations"

import { Component, getComponentElement } from "../../_"
import { SearchQuery, mountSearchQuery } from "../query"
import { SearchResult, mountSearchResult } from "../result"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Search
 */
export type Search =
  | SearchQuery
  | SearchResult

/* ----------------------------------------------------------------------------
 * Helper types
 * ------------------------------------------------------------------------- */

/**
 * Mount options
 */
interface MountOptions {
  index$: ObservableInput<SearchIndex> /* Search index observable */
  keyboard$: Observable<Keyboard>      /* Keyboard observable */
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Mount search
 *
 * This function sets up the search functionality, including the underlying
 * web worker and all keyboard bindings.
 *
 * @param el - Search element
 * @param options - Options
 *
 * @returns Search component observable
 */
export function mountSearch(
  el: HTMLElement, { index$, keyboard$ }: MountOptions
): Observable<Component<Search>> {
  const config = configuration()
  try {
    const worker = setupSearchWorker(config.search, index$)

    /* Retrieve nested components */
    const query  = getComponentElement("search-query", el)
    const result = getComponentElement("search-result", el)

    /* Re-emit query when search is ready */
    const { tx$, rx$ } = worker
    tx$
      .pipe(
        filter(isSearchQueryMessage),
        sample(rx$.pipe(filter(isSearchReadyMessage))),
        take(1)
      )
        .subscribe(tx$.next.bind(tx$))

    /* Set up search keyboard handlers */
    keyboard$
      .pipe(
        filter(({ mode }) => mode === "search")
      )
        .subscribe(key => {
          const active = getActiveElement()
          switch (key.type) {

            /* Enter: prevent form submission */
            case "Enter":
              if (active === query)
                key.claim()
              break

            /* Escape or Tab: close search */
            case "Escape":
            case "Tab":
              setToggle("search", false)
              setElementFocus(query, false)
              break

            /* Vertical arrows: select previous or next search result */
            case "ArrowUp":
            case "ArrowDown":
              if (typeof active === "undefined") {
                setElementFocus(query)
              } else {
                const els = [query, ...getElements(
                  ":not(details) > [href], summary, details[open] [href]",
                  result
                )]
                const i = Math.max(0, (
                  Math.max(0, els.indexOf(active)) + els.length + (
                    key.type === "ArrowUp" ? -1 : +1
                  )
                ) % els.length)
                setElementFocus(els[i])
              }

              /* Prevent scrolling of page */
              key.claim()
              break

            /* All other keys: hand to search query */
            default:
              if (query !== getActiveElement())
                setElementFocus(query)
          }
        })

    /* Set up global keyboard handlers */
    keyboard$
      .pipe(
        filter(({ mode }) => mode === "global"),
      )
        .subscribe(key => {
          switch (key.type) {

            /* Open search and select query */
            case "f":
            case "s":
            case "/":
              setElementFocus(query)
              setElementSelection(query)
              key.claim()
              break
          }
        })

    /* Create and return component */
    const query$ = mountSearchQuery(query, worker)
    return merge(
      query$,
      mountSearchResult(result, worker, { query$ })
    )

  /* Gracefully handle broken search */
  } catch (err) {
    el.hidden = true
    return NEVER
  }
}
