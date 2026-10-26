# Research snapshots

Exported 2026-10-26 from existing project outputs, without rerunning experiments. `manifest.json` records original file names and SHA256 checksums. No API requests, model transcripts, raw security prices or personal material are included.

## CSI500
`csi500.json`: weekly aggregate strategy returns and official total-return benchmark, 695 periods (2013-02—2026-08), across four combination methods. Displayed relative wealth is the compounded strategy wealth divided by compounded benchmark wealth, minus one. `backtest_summary.csv` retains the research's original geometric excess and arithmetic information-ratio conventions; these are different measures.

## Text factors
`text_event_study.csv`: announcement-day response and next-open tradable windows, with sample sizes and t statistics. Windows have different lengths. `text_portfolio.csv`: text-feature and shuffled-placebo comparisons by universe/period; reported improvements are annualized percentage-point differences. `text_guess.csv`: company/date-only controls split around model knowledge cutoffs. Blank entries remain missing, not zero.

## InvestorBench
`investorbench.json`: 100,000-draw null-model intervals and original-paper model aggregate cumulative returns, plus the BTC × Llama-3.1-8B factorial ablation (five runs per cell). Public page dots are paper results, not a claim that all paper models were reproduced. In-interval counts do not establish model equivalence. Original paper: https://aclanthology.org/2025.acl-long.126/ .

All results are historical research. The websites explicitly distinguish selected best results, approximate reproduction, methodological limitations and recent deterioration.
