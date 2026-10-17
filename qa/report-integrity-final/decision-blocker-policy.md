# Decision blocker and action policy

`buildStrictReportViewModel` maintains one internal blocker collection with stable ID, impact, action, evidence refs and decision-impact priority. `addBlocker` registers the blocker explanation and resolving action in the evidence packet. The same collection supplies executive risk/next verification, limitations and prioritized actions; unsupported legacy recommendations are not copied into the report.

Current blockers are evidence-driven: unresolved fact conflict, missing market support, undocumented LAND zoning/permitted use, undocumented relevant residential condition, missing asking/acquisition price, missing actual contractual rent for a hold strategy, unconfirmed operating-expense applicability/amount, and unavailable LAND-development support where the explicit scenario requires it.

An impact explains the decision consequence, not just a missing field name. An action identifies the target and analytical unlock. An unresolved expense action asks whether the expense applies before requesting an amount; unknown does not mean a positive fee or zero. SELL/FSBO and LAND do not inherit rental NOI demands merely because those fields exist in the broader domain.

The default action list takes at most three highest-impact blockers. Decision-blocker detail is bounded and localized. Duplicate near-identical recommendations must not be repeated as an independent open question, next step, limitation and action. The strict PDF layout may collapse text already substantively represented in the executive snapshot without dropping unique evidence or the actionable unlock.

Every generated action is evidence-linked via action:<blocker-id> and its originating refs. `validateReportViewModel` checks claim refs and duplicate action text. Golden PDF checks independently verify evidence completeness, specific action presence and substantive sections. Match Score is profile compatibility, not a decision recommendation or confidence of investment success.
