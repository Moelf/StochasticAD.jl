var documenterSearchIndex = {"docs":
[{"location":"tutorials/particle_filter.html#Differentiable-particle-filter","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"Using a bootstrap particle sampler, we can approximate the posterior distributions of the states given noisy and partial observations of the state of a hidden Markov model by a cloud of K weighted particles with weights W.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"In this tutorial, we are going to:","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"implement a differentiable particle filter based on StochasticAD.jl.\nvisualize the particle filter in d = 2 dimensions.\ncompare the gradient based on the differentiable particle filter to a biased gradient estimator as well as to the gradient of a differentiable Kalman filter.\nshow how to benchmark primal evaluation, forward- and reverse-mode AD of the particle filter.","category":"page"},{"location":"tutorials/particle_filter.html#Setup","page":"Differentiable particle filter","title":"Setup","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"We will make use of several julia packages. For example, we are going to use Distributions and DistributionsAD that implement the reparameterization trick for Gaussian distributions used in the observation and state-transition model, which we specify below. We also import GaussianDistributions.jl to implement the differentiable Kalman filter.","category":"page"},{"location":"tutorials/particle_filter.html#Package-dependencies","page":"Differentiable particle filter","title":"Package dependencies","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"import Pkg\nPkg.activate(\"../../../tutorials\")\nPkg.develop(path=\"../../..\")\nPkg.instantiate()","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"# activate tutorial project file\n\n# load dependencies\nusing StochasticAD\nusing Distributions\nusing DistributionsAD\nusing Random\nusing Statistics\nusing StatsBase\nusing LinearAlgebra\nusing Zygote\nusing ForwardDiff\nusing GaussianDistributions\nusing GaussianDistributions: correct, ⊕\nusing Measurements\nusing UnPack\nusing Plots\nusing LaTeXStrings\nusing BenchmarkTools","category":"page"},{"location":"tutorials/particle_filter.html#Particle-filter","page":"Differentiable particle filter","title":"Particle filter","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"For convenience, we first introduce the new type StochasticModel with the following fields:","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"T: total number of time steps.\nstart: starting distribution for the initial state. For example, in the form of a narrow  Gaussian start(θ) = Gaussian(x0, 0.001 * I(d)).\ndyn: pointwise differentiable stochastic program in the form of Markov transition densities.  For example, dyn(x, θ) = MvNormal(reshape(θ, d, d) * x, Q(θ)), where Q(θ) denotes the  covariance matrix.\nobs: observation model having a smooth conditional probability density depending on  current state x and parameters θ. For example, obs(x, θ) = MvNormal(x, R(θ)),  where R(θ) denotes the covariance matrix.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"For parameters θ,  rand(start(θ)) gives a sample from the prior distribution of the starting distribution. For current state x and parameters θ, xnew = rand(dyn(x, θ)) samples the new state (i.e. dyn gives for each x, θ a distribution-like object). Finally, y = rand(obs(x, θ)) samples an observation.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"We can then define the ParticleFilter type that wraps a stochastic model StochM::StochasticModel, a sampling strategy (with arguments p, K, sump=1) and observational data ys. For simplicity, our implementation assumes a observation-likelihood function being available via pdf(obs(x, θ), y).","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"struct StochasticModel{TType<:Integer,T1,T2,T3}\n    T::TType # time steps\n    start::T1 # prior\n    dyn::T2 # dynamical model\n    obs::T3 # observation model\nend\n\nstruct ParticleFilter{mType<:Integer,MType<:StochasticModel,yType,sType}\n    m::mType # number of particles\n    StochM::MType # stochastic model\n    ys::yType # observations\n    sample_strategy::sType # sampling function\nend","category":"page"},{"location":"tutorials/particle_filter.html#Kalman-filter","page":"Differentiable particle filter","title":"Kalman filter","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"We consider a stochastic program that fulfills the assumptions of a Kalman filter. We follow Kalman.jl to implement a differentiable version. Our KalmanFilter type wraps a stochastic model StochM::StochasticModel and observational data ys. It assumes a observation-likelihood function is implemented via llikelihood(yres, S). The Kalman filter contains the following fields:","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"d: dimension of the state-transition matrix Phi according to x = Phi x + w with w sim operatornameNormal(0Q).\nStochM: Stochastic model of type StochasticModel.\nH: linear map from the state space into the observed space according to y = H x + nu with nu sim operatornameNormal(0R).\nR: covariance matrix entering the observation model according to y = H x + nu with nu sim operatornameNormal(0R).\nQ: covariance matrix entering the state-transition model according to x = Phi x + w with w sim operatornameNormal(0Q).\nys: observations.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"llikelihood(yres, S) = GaussianDistributions.logpdf(Gaussian(zero(yres), Symmetric(S)), yres)\nstruct KalmanFilter{dType<:Integer,MType<:StochasticModel,HType,RType,QType,yType}\n    # H, R = obs\n    # θ, Q = dyn\n    d::dType\n    StochM::MType # stochastic model\n    H::HType # observation model, maps the true state space into the observed space\n    R::RType # observation model, covariance matrix\n    Q::QType # dynamical model, covariance matrix\n    ys::yType # observations\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"To get observations ys from the latent states xs based on the (true, potentially unknown) parameters θ, we simulate a single particle from the forward model returning a vector of observations (no resampling steps).","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"function simulate_single(StochM::StochasticModel, θ)\n    @unpack T, start, dyn, obs = StochM\n    x = rand(start(θ))\n    y = rand(obs(x, θ))\n    xs = [x]\n    ys = [y]\n    for t in 2:T\n        x = rand(dyn(x, θ))\n        y = rand(obs(x, θ))\n        push!(xs, x)\n        push!(ys, y)\n    end\n    xs, ys\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"A particle filter becomes efficient if resampling steps are included. Resampling is numerically attractive because particles with small weight are discarded, so computational resources are not wasted on particles with vanishing weight.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"Here, let us implement a stratified resampling strategy, see for example Murray (2012), where p denotes the probabilities of K particles with sump = sum(p).","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"function sample_stratified(p, K, sump=1)\n    n = length(p)\n    U = rand()\n    is = zeros(Int, K)\n    i = 1\n    cw = p[1]\n    for k in 1:K\n        t = sump * (k - 1 + U) / K\n        while cw < t && i < n\n            i += 1\n            @inbounds cw += p[i]\n        end\n        is[k] = i\n    end\n    return is\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"This sampling strategy can be used within a differentiable resampling step in our particle filter using the use_new_weight function as implemented in StochasticAD.jl. The resample function below returns the states X_new and weights W_new of the resampled particles.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"m: number of particles.\nX: current particle states.\nW: current weight vector of the particles.\nω == sum(W) is an invariant.\nsample_strategy: specific resampling strategy to be used. For example, sample_stratified.\nuse_new_weight=true: Allows one to switch between biased, stop-gradient method and  differentiable resampling step.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"function resample(m, X, W, ω, sample_strategy, use_new_weight=true)\n    js = Zygote.ignore(() -> sample_strategy(W, m, ω))\n    X_new = X[js]\n    if use_new_weight\n        # differentiable resampling\n        W_chosen = W[js]\n        W_new = map(w -> ω * new_weight(w / ω) / m, W_chosen)\n    else\n        # stop gradient, biased approach\n        W_new = fill(ω / m, m)\n    end\n    X_new, W_new\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"Note that we added a if condition that allows us to switch between the differentiable resampling step and the stop-gradient approach.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"We're now equipped with all primitive operations to set up the particle filter, which propagates particles with weights W preserving the invariant ω == sum(W). We never normalize W and, therefore, ω in the code below contains likelihood information. The particle-filter implementation defaults to return particle positions and weights at T if store_path=false and takes the following input arguments:","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"θ: parameters for the stochastic program (state-transition and observation model).\nstore_path=false: Option to store the path of the particles, e.g. to visualize/inspect their trajectories.\nuse_new_weight=true: Option to switch between the stop-gradient and our differentiable resampling step method. Defaults to using differentiable resampling.\ns: controls the number of resampling steps according to t > 1 && t < T && (t % s == 0).","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"function (F::ParticleFilter)(θ; store_path=false, use_new_weight=true, s=1)\n    # s controls the number of resampling steps\n    @unpack m, StochM, ys, sample_strategy = F\n    @unpack T, start, dyn, obs = StochM\n\n\n    X = [rand(start(θ)) for j in 1:m] # particles\n    W = [1 / m for i in 1:m] # weights\n    ω = 1 # total weight\n    store_path && (Xs = [X])\n    for (t, y) in zip(1:T, ys)\n        # update weights & likelihood using observations\n        wi = map(x -> pdf(obs(x, θ), y), X)\n        W = W .* wi\n        ω_old = ω\n        ω = sum(W)\n        # resample particles\n        if t > 1 && t < T && (t % s == 0) # && 1 / sum((W / ω) .^ 2) < length(W) ÷ 32\n            X, W = resample(m, X, W, ω, sample_strategy, use_new_weight)\n        end\n        # update particle states\n        if t < T\n            X = map(x -> rand(dyn(x, θ)), X)\n            store_path && Zygote.ignore(() -> push!(Xs, X))\n        end\n    end\n    (store_path ? Xs : X), W\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"Following Kalman.jl, we implement a differentiable Kalman filter to check the ground-truth gradient. Our Kalman filter returns an updated posterior state estimate and the log-likelihood and takes the parameters of the stochastic program as an input.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"function (F::KalmanFilter)(θ)\n    @unpack d, StochM, H, R, Q = F\n    @unpack start = StochM\n\n    x = start(θ)\n    Φ = reshape(θ, d, d)\n\n    x, yres, S = GaussianDistributions.correct(x, ys[1] + R, H)\n    ll = llikelihood(yres, S)\n    xs = Any[x]\n    for i in 2:length(ys)\n        x = Φ * x ⊕ Q\n        x, yres, S = GaussianDistributions.correct(x, ys[i] + R, H)\n        ll += llikelihood(yres, S)\n\n        push!(xs, x)\n    end\n    xs, ll\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"For both filters, it is straightforward to obtain the log-likelihood via:","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"function log_likelihood(F::ParticleFilter, θ, use_new_weight=true, s=1)\n    _, W = F(θ; store_path=false, use_new_weight=use_new_weight, s=s)\n    log(sum(W))\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"and","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"function log_likelihood(F::KalmanFilter, θ)\n    _, ll = F(θ)\n    ll\nend","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"For convenience, we define functions for","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"forward-mode AD (and differentiable resampling step) to compute the gradient of the log-likelihood of the particle filter.\nreverse-mode AD (and differentiable resampling step) to compute the gradient of the log-likelihood of the particle filter.\nforward-mode AD (and stop-gradient method) to compute the gradient of the log-likelihood of the particle filter (without the new_weight function).\nforward-mode AD to compute the gradient of the log-likelihood of the Kalman filter.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"\nforw_grad(θ, F::ParticleFilter; s=1) = ForwardDiff.gradient(θ -> log_likelihood(F, θ, true, s), θ)\nback_grad(θ, F::ParticleFilter; s=1) = Zygote.gradient(θ -> log_likelihood(F, θ, true, s), θ)[1]\nforw_grad_biased(θ, F::ParticleFilter; s=1) = ForwardDiff.gradient(θ -> log_likelihood(F, θ, false, s), θ)\nforw_grad_Kalman(θ, F::KalmanFilter) = ForwardDiff.gradient(θ -> log_likelihood(F, θ), θ)","category":"page"},{"location":"tutorials/particle_filter.html#Model","page":"Differentiable particle filter","title":"Model","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"Having set up all core functionalities, we can now define the specific stochastic model.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"We consider the following system with a d-dimensional latent process,","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"beginaligned\nx_i = Phi x_i-1 + w_i text with  w_i sim operatornameNormal(0Q)\ny_i = x_i + nu_i text with  nu_i sim operatornameNormal(0R)\nendaligned","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"where Phi is a d-dimensional rotation matrix.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"seed = 423897\n\n### Define model\n# here: n-dimensional rotation matrix\nRandom.seed!(seed)\nT = 20 # time steps\nd = 2 # dimension\n# generate a rotation matrix\nM = randn(d, d)\nc = 0.3 # scaling\nO = exp(c * (M - transpose(M)) / 2)\n@assert det(O) ≈ 1\n@assert transpose(O) * O ≈ I(d)\nθtrue = vec(O) # true parameter\n\n# observation model\nR = 0.01 * collect(I(d))\nobs(x, θ) = MvNormal(x, R) # y = H x + ν with ν ~ Normal(0, R)\n\n# dynamical model\nQ = 0.02 * collect(I(d))\ndyn(x, θ) = MvNormal(reshape(θ, d, d) * x, Q) #  x = Φ*x + w with w ~ Normal(0,Q)\n\n# starting position\nx0 = randn(d)\n# prior distribution\nstart(θ) = Gaussian(x0, 0.001 * collect(I(d)))\n\n# put it all together\nstochastic_model = StochasticModel(T, start, dyn, obs)\n\n# relevant corresponding Kalman filterng defs\nH_Kalman = collect(I(d))\nR_Kalman = Gaussian(zeros(Float64, d), R)\n# Φ_Kalman = O\nQ_Kalman = Gaussian(zeros(Float64, d), Q)\n###\n\n### simulate model\nRandom.seed!(seed)\nxs, ys = simulate_single(stochastic_model, θtrue)","category":"page"},{"location":"tutorials/particle_filter.html#Visualization","page":"Differentiable particle filter","title":"Visualization","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"Using particle_filter(θ; store_path=true) and kalman_filter(θ), it is straightforward to visualize both filters for our observed data.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"m = 1000\nkalman_filter = KalmanFilter(d, stochastic_model, H_Kalman, R_Kalman, Q_Kalman, ys)\nparticle_filter = ParticleFilter(m, stochastic_model, ys, sample_stratified)","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"### run and visualize filters\nXs, W = particle_filter(θtrue; store_path=true)\nfig = plot(getindex.(xs, 1), getindex.(xs, 2), legend=false, xlabel=L\"x_1\", ylabel=L\"x_2\") # x1 and x2 are bad names..conflictng notation\nscatter!(fig, getindex.(ys, 1), getindex.(ys, 2))\nfor i in 1:min(m, 100) # note that Xs has obs noise.\n    local xs = [Xs[t][i] for t in 1:T]\n    scatter!(fig, getindex.(xs, 1), getindex.(xs, 2), marker_z=1:T, color=:cool, alpha=0.1) # color to indicate time step\nend\n\nxs_Kalman, ll_Kalman = kalman_filter(θtrue)\nplot!(getindex.(mean.(xs_Kalman), 1), getindex.(mean.(xs_Kalman), 2), legend=false, color=\"red\")\npng(\"pf_1\") # hide","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"(Image: )","category":"page"},{"location":"tutorials/particle_filter.html#Bias","page":"Differentiable particle filter","title":"Bias","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"We can also investigate the distribution of the gradients from the particle filter with and without differentiable resampling step, as compared to the gradient computed by differentiating the Kalman filter.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"### compute gradients\nRandom.seed!(seed)\nX = [forw_grad(θtrue, particle_filter) for i in 1:200] # gradient of the particle filter *with* differentiation of the resampling step\nRandom.seed!(seed)\nXbiased = [forw_grad_biased(θtrue, particle_filter) for i in 1:200] # Gradient of the particle filter *without* differentiation of the resampling step\n# pick an arbitrary coordinate\nindex = 1 # take derivative with respect to first parameter (2-dimensional example has a rotation matrix with four parameters in total)\n# plot histograms for the sampled derivative values\nfig = plot(normalize(fit(Histogram, getindex.(X, index), nbins=20), mode=:pdf), legend=false) # ours\nplot!(normalize(fit(Histogram, getindex.(Xbiased, index), nbins=20), mode=:pdf)) # biased\nvline!([mean(X)[index]], color=1)\nvline!([mean(Xbiased)[index]], color=2)\n# add derivative of differentiable Kalman filter as a comparison\nXK = forw_grad_Kalman(θtrue, kalman_filter)\nvline!([XK[index]], color=\"black\")\npng(\"pf_2\") # hide","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"(Image: )","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"The estimator using the new_weight function agrees with the gradient value from the Kalman filter and the particle filter AD scheme developed by Ścibior and Wood, unlike biased estimators that neglect the contribution of the derivative from the resampling step. However, the biased estimator displays a smaller variance.","category":"page"},{"location":"tutorials/particle_filter.html#Benchmark","page":"Differentiable particle filter","title":"Benchmark","text":"","category":"section"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"Finally, we can use BenchmarkTools.jl to benchmark the run times of the primal pass with respect to forward-mode and reverse-mode AD of the particle filter. As expected, forward-mode AD outperforms reverse-mode AD for the small number of parameters considered here.","category":"page"},{"location":"tutorials/particle_filter.html","page":"Differentiable particle filter","title":"Differentiable particle filter","text":"# secs for how long the benchmark should run, see https://juliaci.github.io/BenchmarkTools.jl/stable/\nsecs = 1\n\nsuite = BenchmarkGroup()\nsuite[\"scaling\"] = BenchmarkGroup([\"grads\"])\n\nsuite[\"scaling\"][\"primal\"] = @benchmarkable log_likelihood(particle_filter, θtrue)\nsuite[\"scaling\"][\"forward\"] = @benchmarkable forw_grad(θtrue, particle_filter)\nsuite[\"scaling\"][\"backward\"] = @benchmarkable back_grad(θtrue, particle_filter)\n\ntune!(suite)\nresults = run(suite, verbose=true, seconds=secs)\n\nt1 = measurement(mean(results[\"scaling\"][\"primal\"].times), std(results[\"scaling\"][\"primal\"].times) / sqrt(length(results[\"scaling\"][\"primal\"].times)))\nt2 = measurement(mean(results[\"scaling\"][\"forward\"].times), std(results[\"scaling\"][\"forward\"].times) / sqrt(length(results[\"scaling\"][\"forward\"].times)))\nt3 = measurement(mean(results[\"scaling\"][\"backward\"].times), std(results[\"scaling\"][\"backward\"].times) / sqrt(length(results[\"scaling\"][\"backward\"].times)))\n@show t1 t2 t3\n\nts = (t1, t2, t3) ./ 10^6 # ms\n@show ts","category":"page"},{"location":"index.html#StochasticAD","page":"Introduction","title":"StochasticAD","text":"","category":"section"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"StochasticAD is an experimental, research package for automatic differentiation (AD) of stochastic programs. It implements AD algorithms for handling functions which are discrete and random, based on the methodology developed in [TODO].","category":"page"},{"location":"index.html#Preview","page":"Introduction","title":"Preview","text":"","category":"section"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"Derivatives are all about how functions are affected by tiny changes in their input. To understand the effect of a tiny change, instead of providing a standard real number to a function, we can provide an object called a stochastic triple. First, let's consider a deterministic function.","category":"page"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"using StochasticAD\nf(p) = p^2\nstochastic_triple(f, 2) # Feeds 2 + ε into f","category":"page"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"The output tells us that if we change the input 2 by a tiny amount ε, the output of f will change by around 4ε. This is the case we're familiar with. But what happens with a discrete random function? Let's give it a try. ","category":"page"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"import Random # hide\nRandom.seed!(4321) # hide\nusing StochasticAD, Distributions\nf(p) = rand(Bernoulli(p)) # 1 with probability p, 0 otherwise\nstochastic_triple(f, 0.5) # Feeds 0.5 + ε into f","category":"page"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"The output of a Bernoulli variable cannot change by a tiny amount: it is either 0 or 1. But in the probabilistic world, there is another way to change by a tiny amount on average: jump by a large amount, with tiny probability. The purpose of the third component of the stochastic triple is to describe these perturbations. Here, the stochastic triple says that the original random output was 0, but given a small change ε in the input, the output will jump up to 1 with probability around 2ε.","category":"page"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"Stochastic triples can be used to construct a new random program whose average is the derivative of the average of the original program. Let's try a crazier example, where we mix discrete and continuous randomness!","category":"page"},{"location":"index.html","page":"Introduction","title":"Introduction","text":"using StochasticAD, Distributions\nimport Random # hide\nRandom.seed!(1234) # hide\n\nfunction X(p)\n    a = p*(1-p) \n    b = rand(Binomial(10, p))\n    c = 2 * b + 3 * rand(Bernoulli(p))\n    return a * c * rand(Normal(b, a))\nend\n\nst = @show stochastic_triple(X, 0.6) # sample a single stochastic triple at p = 0.6\n@show derivative_contribution(st) # which produces a single derivative estimate...\n\nsamples = [derivative_estimate(X, 0.6) for i in 1:1000] # many samples from derivative program\nderivative = mean(samples)\nuncertainty = std(samples) / sqrt(1000)\nprintln(\"derivative of 𝔼[X(p)] = $derivative ± $uncertainty\")","category":"page"}]
}