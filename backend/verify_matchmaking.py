"""
Quick verification script for optimized matchmaking algorithm.

Run this to verify the optimized matchmaking algorithm works correctly.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from algorithms.matchmaking_optimized import get_matchmaker, OptimizedMatchmaker
from sqlalchemy.ext.asyncio import AsyncSession


async def verify_imports():
    """Verify all imports work correctly."""
    print("✓ Verifying imports...")
    try:
        from algorithms.matchmaking_optimized import (
            get_matchmaker,
            OptimizedMatchmaker,
            MatchCandidate,
            start_matchmaker,
            shutdown_matchmaker,
            trigger_matchmaking_now
        )
        print("  ✓ All imports successful")
        return True
    except Exception as e:
        print(f"  ✗ Import failed: {e}")
        return False


async def verify_matchmaker_creation():
    """Verify matchmaker instance can be created."""
    print("\n✓ Verifying matchmaker creation...")
    try:
        matchmaker = get_matchmaker()
        assert isinstance(matchmaker, OptimizedMatchmaker)
        print("  ✓ Matchmaker instance created successfully")
        return True
    except Exception as e:
        print(f"  ✗ Matchmaker creation failed: {e}")
        return False


async def verify_embedding_extraction():
    """Verify embedding extraction works."""
    print("\n✓ Verifying embedding extraction...")
    try:
        matchmaker = get_matchmaker()
        
        # Test valid embedding
        valid_embedding = {'embedding': [0.1, 0.2, 0.3, 0.4]}
        result = matchmaker.extract_embedding(valid_embedding)
        assert result is not None
        assert isinstance(result, type(valid_embedding['embedding']))
        print("  ✓ Valid embedding extraction works")
        
        # Test invalid embedding
        invalid_embedding = {'foo': 'bar'}
        result = matchmaker.extract_embedding(invalid_embedding)
        assert result is None
        print("  ✓ Invalid embedding handling works")
        
        # Test None embedding
        result = matchmaker.extract_embedding(None)
        assert result is None
        print("  ✓ None embedding handling works")
        
        return True
    except Exception as e:
        print(f"  ✗ Embedding extraction failed: {e}")
        return False


async def verify_similarity_computation():
    """Verify similarity computation works."""
    print("\n✓ Verifying similarity computation...")
    try:
        matchmaker = get_matchmaker()
        
        # Test identical vectors
        vec1 = [0.1, 0.2, 0.3, 0.4]
        vec2 = [0.1, 0.2, 0.3, 0.4]
        import numpy as np
        sim = matchmaker.compute_semantic_similarity(np.array(vec1), np.array(vec2))
        assert sim > 0.99
        print(f"  ✓ Identical vectors: similarity = {sim:.4f}")
        
        # Test orthogonal vectors
        vec3 = [1.0, 0.0, 0.0, 0.0]
        vec4 = [0.0, 1.0, 0.0, 0.0]
        sim = matchmaker.compute_semantic_similarity(np.array(vec3), np.array(vec4))
        assert sim < 0.01
        print(f"  ✓ Orthogonal vectors: similarity = {sim:.4f}")
        
        return True
    except Exception as e:
        print(f"  ✗ Similarity computation failed: {e}")
        return False


async def verify_thematic_overlap():
    """Verify thematic overlap computation works."""
    print("\n✓ Verifying thematic overlap...")
    try:
        matchmaker = get_matchmaker()
        
        # Test high overlap
        overlap = matchmaker.compute_thematic_overlap(
            ['climate', 'energy', 'sustainability'],
            ['climate', 'energy', 'renewables'],
            ['sustainability']
        )
        assert overlap > 0.5
        print(f"  ✓ High overlap: {overlap:.4f}")
        
        # Test no overlap
        overlap = matchmaker.compute_thematic_overlap(
            ['climate', 'energy'],
            ['health', 'medicine'],
            ['finance']
        )
        assert overlap == 0.0
        print(f"  ✓ No overlap: {overlap:.4f}")
        
        return True
    except Exception as e:
        print(f"  ✗ Thematic overlap failed: {e}")
        return False


async def verify_region_match():
    """Verify region matching works."""
    print("\n✓ Verifying region matching...")
    try:
        matchmaker = get_matchmaker()
        
        # Test matching region
        regions = ['USA', 'Canada', 'Mexico']
        location = {'country': 'United States', 'city': 'New York'}
        match = matchmaker.check_region_match(regions, location)
        assert match is True
        print("  ✓ Region match works")
        
        # Test non-matching region
        location = {'country': 'France', 'city': 'Paris'}
        match = matchmaker.check_region_match(regions, location)
        assert match is False
        print("  ✓ Non-matching region works")
        
        return True
    except Exception as e:
        print(f"  ✗ Region matching failed: {e}")
        return False


async def verify_dataclass():
    """Verify MatchCandidate dataclass works."""
    print("\n✓ Verifying MatchCandidate dataclass...")
    try:
        from algorithms.matchmaking_optimized import MatchCandidate
        import uuid
        
        candidate = MatchCandidate(
            funder_id="123e4567-e89b-12d3-a456-426614174000",
            entity_id="123e4567-e89b-12d3-a456-426614174001",
            score=0.85,
            reason="High semantic match",
            entity_name="MIT Climate Lab",
            funder_name="Climate Ventures",
            profile_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174002"),
            point_of_contact={'name': 'John Doe'}
        )
        
        assert candidate.score == 0.85
        assert candidate.funder_id == "123e4567-e89b-12d3-a456-426614174000"
        print("  ✓ MatchCandidate dataclass works")
        
        return True
    except Exception as e:
        print(f"  ✗ MatchCandidate dataclass failed: {e}")
        return False


async def verify_configuration():
    """Verify configuration values are reasonable."""
    print("\n✓ Verifying configuration...")
    try:
        from algorithms.matchmaking_optimized import (
            SIMILARITY_THRESHOLD,
            MAX_MATCHES_PER_FUNDER,
            BATCH_SIZE,
            WEIGHTS,
            MATCH_INTERVAL_MINUTES
        )
        
        assert 0 <= SIMILARITY_THRESHOLD <= 1
        print(f"  ✓ SIMILARITY_THRESHOLD = {SIMILARITY_THRESHOLD}")
        
        assert MAX_MATCHES_PER_FUNDER > 0
        print(f"  ✓ MAX_MATCHES_PER_FUNDER = {MAX_MATCHES_PER_FUNDER}")
        
        assert BATCH_SIZE > 0
        print(f"  ✓ BATCH_SIZE = {BATCH_SIZE}")
        
        assert sum(WEIGHTS.values()) == 1.0
        print(f"  ✓ WEIGHTS sum = {sum(WEIGHTS.values())}")
        
        assert MATCH_INTERVAL_MINUTES > 0
        print(f"  ✓ MATCH_INTERVAL_MINUTES = {MATCH_INTERVAL_MINUTES}")
        
        return True
    except Exception as e:
        print(f"  ✗ Configuration verification failed: {e}")
        return False


async def run_all_verifications():
    """Run all verification tests."""
    print("=" * 60)
    print("OPTIMIZED MATCHMAKING VERIFICATION")
    print("=" * 60)
    
    tests = [
        verify_imports,
        verify_matchmaker_creation,
        verify_embedding_extraction,
        verify_similarity_computation,
        verify_thematic_overlap,
        verify_region_match,
        verify_dataclass,
        verify_configuration
    ]
    
    results = []
    for test in tests:
        try:
            result = await test()
            results.append(result)
        except Exception as e:
            print(f"\n✗ Test failed with exception: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All verifications passed! The optimized algorithm is ready.")
        return 0
    else:
        print(f"\n✗ {total - passed} verification(s) failed. Please review errors above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_all_verifications())
    sys.exit(exit_code)