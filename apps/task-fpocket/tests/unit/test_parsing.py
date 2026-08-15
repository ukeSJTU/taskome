"""Pure unit tests for fpocket's `<code>_info.txt` descriptor parser."""

from fpocket_server.adapter import _parse_pockets

_TWO_POCKET_INFO = """Pocket 1 :
\tScore : \t0.647
\tDruggability Score : \t0.855
\tNumber of Alpha Spheres : \t143
\tTotal SASA : \t219.232
\tPolar SASA : \t115.376
\tApolar SASA : \t103.856
\tVolume : \t1429.321
\tMean local hydrophobic density : \t53.083
\tMean alpha sphere radius :\t3.977
\tMean alp. sph. solvent access : \t0.451
\tApolar alpha sphere proportion : \t0.503
\tHydrophobicity score:\t39.727
\tVolume score: \t 3.939
\tPolarity score:\t 13
\tCharge score :\t -2
\tProportion of polar atoms: \t36.905
\tAlpha sphere density : \t8.233
\tCent. of mass - Alpha Sphere max dist: \t21.512
\tFlexibility : \t0.136

Pocket 2 :
\tScore : \t0.122
\tDruggability Score : \t0.116
\tNumber of Alpha Spheres : \t70
\tTotal SASA : \t219.843
\tPolar SASA : \t72.275
\tApolar SASA : \t147.568
\tVolume : \t782.998
\tMean local hydrophobic density : \t27.481
\tMean alpha sphere radius :\t3.9
\tMean alp. sph. solvent access : \t0.5
\tApolar alpha sphere proportion : \t0.4
\tHydrophobicity score:\t10.0
\tVolume score: \t 2.0
\tPolarity score:\t 5
\tCharge score :\t 0
\tProportion of polar atoms: \t40.0
\tAlpha sphere density : \t7.0
\tCent. of mass - Alpha Sphere max dist: \t18.0
\tFlexibility : \t0.2
"""


def test_parse_pockets_extracts_curated_fields_in_rank_order() -> None:
    pockets = _parse_pockets(_TWO_POCKET_INFO)

    assert [pocket.rank for pocket in pockets] == [1, 2]
    first, second = pockets
    assert first.score == 0.647
    assert first.druggability_score == 0.855
    assert first.num_alpha_spheres == 143
    assert first.volume == 1429.321
    assert second.score == 0.122
    assert second.num_alpha_spheres == 70


def test_parse_pockets_returns_empty_tuple_for_no_pockets_text() -> None:
    assert _parse_pockets("") == ()
