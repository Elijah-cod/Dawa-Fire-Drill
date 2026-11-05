from dawa_api.explain.service import explain_selection
from dawa_api.optimization.service import Candidate, select_actions


def test_explanation_restates_solver_result_without_changing_ranking():
    candidates = [Candidate("alpha", 3, 5), Candidate("beta", 5, 4)]
    result = select_actions(candidates, budget=3)
    explanation = explain_selection(result, budget=3)
    assert explanation.selected_ids == result.selected_ids == ("alpha",)
    assert "alpha" in explanation.text and "beta" in explanation.text
    assert "illustrative" in explanation.text.lower()
    assert "accuracy" not in explanation.text.lower()
