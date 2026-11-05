# Synthetic data assumptions

The generator produces synthetic demo records only. Model outputs remain illustrative and unvalidated.

- Facility level mix is guided by the national public-facility counts in Table 2 of the [Kenya Health Labour Market Analysis 2023](https://files.aho.afro.who.int/afahobckpcontainer/production/files/Kenya_HLMA_Report_2023_v8.pdf), which cites the Kenya Master Facility List for 2022. It lists 4,807 level 2, 1,123 level 3, 360 level 4, and 14 level 5 public facilities. The 40-facility demo uses 29, 7, 3, and 1 respectively; rare higher levels are deliberately oversampled. It is a synthetic county and is not an estimate for any actual county.
- The generator uses 10 anonymous commodity identifiers and 24 monthly periods. Baseline demand, seasonality, lead times, budget values, release fractions, and delivery timing are arbitrary reproducible assumptions, not calibrated observations or clinical data. They cannot support operational decisions.
- TODO: verify appropriate public aggregate sources for commodity demand, lead times, and funding parameters before describing those quantities as calibrated. Do not infer facility-level observations from national aggregates.
- The default pseudorandom seed is 42 and can be changed with `python -m dawa_api.ingestion.synthetic --seed 42`. The CLI emits JSON; all identifiers are invented. It does not persist or ingest real records.
- The `ZZ` country adapter is an intentionally non-operational placeholder, not a real country or data source.
