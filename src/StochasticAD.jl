module StochasticAD

### Public API

export stochastic_triple, derivative_contribution, perturbations # For working with stochastic triples
export derivative_estimate, StochasticModel, stochastic_gradient # Higher level functionality
export new_weight # Particle resampling

### Imports

using Random
using Distributions
using DistributionsAD
using ChainRulesCore
using ChainRulesOverloadGeneration
using ExprTools
using ForwardDiff
using Functors
import ChainRulesCore
# resolve conflicts while this code exists in both.
const on_new_rule = ChainRulesOverloadGeneration.on_new_rule
const refresh_rules = ChainRulesOverloadGeneration.refresh_rules

const RNG = copy(Random.default_rng())

### Files responsible for backends

include("finite_infinitesimals.jl")
include("backends/pruned.jl")
include("backends/pruned_aggressive.jl")
include("backends/dict.jl")
include("backends/smoothed.jl")
using .PrunedFIsBackend
using .PrunedFIsAggressiveBackend
using .DictFIsBackend
using .SmoothedFIsBackend

include("prelude.jl") # Defines global constants
include("smoothing.jl") # Smoothing rules. Placed before general rules so that new_weight frule is caught by overload generation.
include("stochastic_triple.jl") # Defines stochastic triple object and higher level functions
include("general_rules.jl") # Defines rules for propagation through deterministic functions
include("discrete_randomness.jl") # Defines rules for propagation through discrete random functions
include("propagate.jl") # Experimental generalized forward propagation functionality
include("misc.jl") # Miscellaneous functions that do not fit in the usual flow

end