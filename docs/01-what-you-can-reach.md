# What you can reach on a closed platform

Before quoting any remediation on Wix or Squarespace, establish which layer
each finding lives in. It determines what the fix costs, whether it survives,
and whether it is possible at all.

## The four layers

**1. Settings.** Alt text, heading levels, link text, button labels, form
labels, colours. Both platforms expose more of this than people expect. A fix
here belongs to the client, appears in their editor, and survives platform
updates.

**2. Content.** Wording of links and headings, reading order of sections,
whether a decorative image should be there at all. Same properties as settings.

**3. Injected code.** CSS and JavaScript added through the platform's code
injection feature. Reaches things settings cannot. Does not belong to the
client in any meaningful sense, breaks silently on platform updates, and needs
documenting or it becomes invisible debt.

**4. Out of reach.** Platform-generated markup, cross-origin iframes, and on
Wix the viewport meta tag. No amount of effort changes these.

Work top down. A finding fixed in settings costs a few minutes and stays
fixed. The same finding fixed in injected code costs longer, needs guarding
against re-render, and will eventually break.

## Cross-origin iframes

An embedded form, booking system, review widget or cost estimator served from
another company's domain sits inside a cross-origin iframe.

No script, stylesheet, overlay or platform app on the parent page can read or
modify what is inside it. This is the browser's same-origin policy. It is a
deliberate security boundary that applies to every website in existence, it is
not caused by anything in the site's configuration, and no vendor can override
it. Any product claiming otherwise is either wrong or is describing something
else.

WCAG anticipates this. A page may claim partial conformance for a component it
does not control, provided the component is identified and the limitation is
documented.

So the correct handling is:

1. Identify the component and what it does.
2. State that it is served from another origin and cannot be modified from the
   containing page.
3. Give it an accessible name with a `title` attribute on the iframe, which is
   the one thing you can control.
4. Provide an accessible alternative route to the same outcome where one is
   possible: a phone number, an email address, a plain HTML form.
5. Record it in the accessibility statement.
6. Log a request with the vendor and give the client the vendor's
   accessibility contact.

Do not claim you fixed it. Do not let anyone else claim it either.

## Wix and the viewport tag

Wix controls the viewport meta tag and it has historically included
`maximum-scale`. You cannot edit it from the editor, from Velo, or from Custom
Code in a way that reliably survives.

The honest handling is to test pinch-zoom on a real device, record the actual
current behaviour, and if it is blocked, document it as a platform limitation.
Reporting it as remediated when it is not is the kind of claim that unravels
when somebody checks.

## Platform performance

Both platforms load a large amount of their own JavaScript that nobody working
inside the editor can remove. On a typical site this accounts for the majority
of measured load time.

Two things follow. First, it is a characteristic of the platform rather than a
fault in the site, and clients deserve to hear it that way rather than being
sold an optimisation that cannot deliver. Second, it is not an accessibility
finding and should not appear in an accessibility report as one. Total Blocking
Time is a performance metric; listing it among WCAG findings, mapped to no
success criterion, is a category error that appears in automated report
products more often than it should.

## Writing the scope

The framing that holds up:

> Findings fall into three groups. Most are fixable in the site editor and
> those changes belong to you permanently. A smaller set needs custom code
> injected into the site, which I will document so your next developer knows it
> is there and what breaks it. Three items sit outside the platform entirely:
> the booking widget, which is served from another company's domain and cannot
> be modified from your site, and two platform behaviours I will document in
> your accessibility statement.

Precise, honest, and it sets the boundary before the work starts rather than
after somebody notices.
