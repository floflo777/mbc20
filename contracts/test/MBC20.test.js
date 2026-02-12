const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MBC-20 Protocol", function () {
  let claimManager, factory, marketplace, mockUsdc;
  let deployer, signer, user1, user2, treasury;

  const CLAIM_FEE = ethers.parseEther("0.0001");
  const TICK = "CLAW";
  const MAX_SUPPLY = ethers.parseEther("21000000"); // 21M with 18 decimals
  const REWARD_POOL = "0x174910FBc832931FA5DF3E9014d51c964BF0D4fF";

  beforeEach(async function () {
    [deployer, signer, user1, user2, treasury] = await ethers.getSigners();

    // Deploy mock USDC (using MBC20Token with no fees as simple ERC20)
    const MockERC20 = await ethers.getContractFactory("MBC20Token");
    mockUsdc = await MockERC20.deploy("USD Coin", "USDC", ethers.MaxUint256, deployer.address, ethers.ZeroAddress, ethers.ZeroAddress, deployer.address);
    await mockUsdc.waitForDeployment();

    // Mint USDC to users
    await mockUsdc.mint(user1.address, 1_000_000n * 10n ** 18n);
    await mockUsdc.mint(user2.address, 1_000_000n * 10n ** 18n);

    // Predict factory address
    const nonce = await deployer.getNonce();
    const futureFactory = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 1 });

    // Deploy ClaimManager
    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    claimManager = await ClaimManager.deploy(futureFactory, signer.address, treasury.address, CLAIM_FEE);
    await claimManager.waitForDeployment();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("MBC20Factory");
    factory = await Factory.deploy(await claimManager.getAddress(), treasury.address, REWARD_POOL);
    await factory.waitForDeployment();

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("MBC20Marketplace");
    marketplace = await Marketplace.deploy(await mockUsdc.getAddress());
    await marketplace.waitForDeployment();
  });

  async function signClaim(wallet, tick, totalAmount, nonce) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "string", "uint256", "uint256", "uint256"],
      [wallet, tick, totalAmount, nonce, chainId]
    );
    return signer.signMessage(ethers.getBytes(messageHash));
  }

  async function setupClawToken(claimAmount) {
    await claimManager.initToken(TICK, MAX_SUPPLY);
    const tokenAddr = await factory.getToken(TICK);
    const token = await ethers.getContractAt("MBC20Token", tokenAddr);
    if (claimAmount) {
      const sig = await signClaim(user1.address, TICK, claimAmount, 0n);
      await claimManager.connect(user1).claim(TICK, claimAmount, 0n, sig, { value: CLAIM_FEE });
    }
    return token;
  }

  describe("Token Creation", function () {
    it("should init a token via ClaimManager", async function () {
      await claimManager.initToken(TICK, MAX_SUPPLY);
      const tokenAddr = await factory.getToken(TICK);
      expect(tokenAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("should reject duplicate token creation", async function () {
      await claimManager.initToken(TICK, MAX_SUPPLY);
      await expect(claimManager.initToken(TICK, MAX_SUPPLY)).to.be.revertedWithCustomError(factory, "TokenAlreadyExists");
    });

    it("should set correct name, symbol, and config", async function () {
      await claimManager.initToken(TICK, MAX_SUPPLY);
      const tokenAddr = await factory.getToken(TICK);
      const token = await ethers.getContractAt("MBC20Token", tokenAddr);
      expect(await token.name()).to.equal("mbc-20: CLAW");
      expect(await token.symbol()).to.equal("CLAW");
      expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
      expect(await token.teamWallet()).to.equal(treasury.address);
      expect(await token.rewardPool()).to.equal(REWARD_POOL);
    });
  });

  describe("Claiming", function () {
    beforeEach(async function () {
      await claimManager.initToken(TICK, MAX_SUPPLY);
    });

    it("should claim tokens with valid signature", async function () {
      const amount = ethers.parseEther("1000");
      const sig = await signClaim(user1.address, TICK, amount, 0n);
      await claimManager.connect(user1).claim(TICK, amount, 0n, sig, { value: CLAIM_FEE });

      const tokenAddr = await factory.getToken(TICK);
      const token = await ethers.getContractAt("MBC20Token", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("should claim delta on second claim", async function () {
      const amount1 = ethers.parseEther("1000");
      const sig1 = await signClaim(user1.address, TICK, amount1, 0n);
      await claimManager.connect(user1).claim(TICK, amount1, 0n, sig1, { value: CLAIM_FEE });

      const amount2 = ethers.parseEther("2500");
      const sig2 = await signClaim(user1.address, TICK, amount2, 1n);
      await claimManager.connect(user1).claim(TICK, amount2, 1n, sig2, { value: CLAIM_FEE });

      const tokenAddr = await factory.getToken(TICK);
      const token = await ethers.getContractAt("MBC20Token", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(amount2);
    });

    it("should reject invalid signature", async function () {
      const amount = ethers.parseEther("1000");
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "uint256", "uint256", "uint256"],
        [user1.address, TICK, amount, 0n, chainId]
      );
      const badSig = await user2.signMessage(ethers.getBytes(messageHash));

      await expect(
        claimManager.connect(user1).claim(TICK, amount, 0n, badSig, { value: CLAIM_FEE })
      ).to.be.revertedWithCustomError(claimManager, "InvalidSignature");
    });

    it("should reject wrong nonce", async function () {
      const amount = ethers.parseEther("1000");
      const sig = await signClaim(user1.address, TICK, amount, 1n);
      await expect(
        claimManager.connect(user1).claim(TICK, amount, 1n, sig, { value: CLAIM_FEE })
      ).to.be.revertedWithCustomError(claimManager, "InvalidNonce");
    });

    it("should reject claim with no new tokens", async function () {
      const amount = ethers.parseEther("1000");
      const sig1 = await signClaim(user1.address, TICK, amount, 0n);
      await claimManager.connect(user1).claim(TICK, amount, 0n, sig1, { value: CLAIM_FEE });

      const sig2 = await signClaim(user1.address, TICK, amount, 1n);
      await expect(
        claimManager.connect(user1).claim(TICK, amount, 1n, sig2, { value: CLAIM_FEE })
      ).to.be.revertedWithCustomError(claimManager, "NothingToClaim");
    });

    it("should reject claim without fee", async function () {
      const amount = ethers.parseEther("1000");
      const sig = await signClaim(user1.address, TICK, amount, 0n);
      await expect(
        claimManager.connect(user1).claim(TICK, amount, 0n, sig, { value: 0 })
      ).to.be.revertedWithCustomError(claimManager, "InsufficientFee");
    });

    it("should send fee to treasury", async function () {
      const amount = ethers.parseEther("1000");
      const sig = await signClaim(user1.address, TICK, amount, 0n);

      const balBefore = await ethers.provider.getBalance(treasury.address);
      await claimManager.connect(user1).claim(TICK, amount, 0n, sig, { value: CLAIM_FEE });
      const balAfter = await ethers.provider.getBalance(treasury.address);

      expect(balAfter - balBefore).to.equal(CLAIM_FEE);
    });
  });

  describe("Trading Fees", function () {
    let token;

    beforeEach(async function () {
      token = await setupClawToken(ethers.parseEther("100000"));
      await token.setPool(user2.address, true);
    });

    it("should charge 2% fee on sells", async function () {
      const amount = ethers.parseEther("1000");
      const balBefore = await token.balanceOf(user2.address);
      await token.connect(user1).transfer(user2.address, amount);
      const balAfter = await token.balanceOf(user2.address);

      // Pool receives 980 (1000 - 2%)
      expect(balAfter - balBefore).to.equal(ethers.parseEther("980"));
    });

    it("should split fees: 1% burn, 0.5% team, 0.5% reward", async function () {
      const amount = ethers.parseEther("10000");

      const supplyBefore = await token.totalSupply();
      const teamBefore = await token.balanceOf(treasury.address);
      const rewardBefore = await token.balanceOf(REWARD_POOL);

      await token.connect(user1).transfer(user2.address, amount);

      const supplyAfter = await token.totalSupply();
      const teamAfter = await token.balanceOf(treasury.address);
      const rewardAfter = await token.balanceOf(REWARD_POOL);

      // 1% burn = 100, 0.5% team = 50, 0.5% reward = 50
      expect(supplyBefore - supplyAfter).to.equal(ethers.parseEther("100"));
      expect(teamAfter - teamBefore).to.equal(ethers.parseEther("50"));
      expect(rewardAfter - rewardBefore).to.equal(ethers.parseEther("50"));
    });

    it("should charge 2% fee on buys (from pool)", async function () {
      // Give pool some tokens
      const setupAmount = ethers.parseEther("5000");
      await token.connect(user1).transfer(user2.address, setupAmount);

      // Buy: pool (user2) → deployer
      const buyAmount = ethers.parseEther("1000");
      const deployerBefore = await token.balanceOf(deployer.address);
      await token.connect(user2).transfer(deployer.address, buyAmount);
      const deployerAfter = await token.balanceOf(deployer.address);

      // Buyer receives 980 (1000 - 2%)
      expect(deployerAfter - deployerBefore).to.equal(ethers.parseEther("980"));
    });

    it("should NOT charge fees on wallet-to-wallet transfers", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(user1).transfer(deployer.address, amount);
      expect(await token.balanceOf(deployer.address)).to.equal(amount);
    });
  });

  describe("Burn for Discount", function () {
    let token;

    beforeEach(async function () {
      token = await setupClawToken(ethers.parseEther("100000"));
    });

    it("should burn tokens and track burnedByUser", async function () {
      const burnAmount = ethers.parseEther("500");
      await token.connect(user1).burn(burnAmount);

      expect(await token.burnedByUser(user1.address)).to.equal(burnAmount);
    });

    it("should reduce total supply", async function () {
      const supplyBefore = await token.totalSupply();
      const burnAmount = ethers.parseEther("1000");
      await token.connect(user1).burn(burnAmount);
      expect(await token.totalSupply()).to.equal(supplyBefore - burnAmount);
    });

    it("should reject zero burn", async function () {
      await expect(
        token.connect(user1).burn(0)
      ).to.be.revertedWithCustomError(token, "ZeroAmount");
    });

    it("should emit Burned event", async function () {
      const burnAmount = ethers.parseEther("100");
      await expect(token.connect(user1).burn(burnAmount))
        .to.emit(token, "Burned")
        .withArgs(user1.address, burnAmount, burnAmount);
    });

    it("should accumulate burns across multiple calls", async function () {
      await token.connect(user1).burn(ethers.parseEther("100"));
      await token.connect(user1).burn(ethers.parseEther("200"));
      expect(await token.burnedByUser(user1.address)).to.equal(ethers.parseEther("300"));
    });
  });

  describe("Burn Discount Tiers", function () {
    let token;

    beforeEach(async function () {
      token = await setupClawToken(ethers.parseEther("100000"));
    });

    it("should return 0 discount with no burns", async function () {
      expect(await token.getBurnDiscountBPS(user1.address)).to.equal(0);
    });

    it("should return 10 BPS (0.1%) after burning 100 tokens", async function () {
      await token.connect(user1).burn(ethers.parseEther("100"));
      expect(await token.getBurnDiscountBPS(user1.address)).to.equal(10);
    });

    it("should return 20 BPS (0.2%) after burning 200 tokens", async function () {
      await token.connect(user1).burn(ethers.parseEther("200"));
      expect(await token.getBurnDiscountBPS(user1.address)).to.equal(20);
    });

    it("should return 50 BPS (0.5%) after burning 500 tokens", async function () {
      await token.connect(user1).burn(ethers.parseEther("500"));
      expect(await token.getBurnDiscountBPS(user1.address)).to.equal(50);
    });

    it("should return 100 BPS (1%) after burning 1000 tokens", async function () {
      await token.connect(user1).burn(ethers.parseEther("1000"));
      expect(await token.getBurnDiscountBPS(user1.address)).to.equal(100);
    });

    it("should return 150 BPS (1.5%) after burning 5000 tokens", async function () {
      await token.connect(user1).burn(ethers.parseEther("5000"));
      expect(await token.getBurnDiscountBPS(user1.address)).to.equal(150);
    });

    it("should return 200 BPS (2%) after burning 10000 tokens — fee-free", async function () {
      await token.connect(user1).burn(ethers.parseEther("10000"));
      expect(await token.getBurnDiscountBPS(user1.address)).to.equal(200);
    });
  });

  describe("Discount Reduction Order", function () {
    let token;

    beforeEach(async function () {
      token = await setupClawToken(ethers.parseEther("100000"));
      await token.setPool(user2.address, true);
    });

    it("burn 100: 0.1% off burn → 0.9% burn, 0.5% reward, 0.5% team = 1.9% fee", async function () {
      await token.connect(user1).burn(ethers.parseEther("100"));

      const amount = ethers.parseEther("10000");
      const supplyBefore = await token.totalSupply();
      const teamBefore = await token.balanceOf(treasury.address);
      const rewardBefore = await token.balanceOf(REWARD_POOL);
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      // 0.9% burn = 90, 0.5% team = 50, 0.5% reward = 50, received = 9810
      expect(supplyBefore - await token.totalSupply()).to.equal(ethers.parseEther("90"));
      expect((await token.balanceOf(treasury.address)) - teamBefore).to.equal(ethers.parseEther("50"));
      expect((await token.balanceOf(REWARD_POOL)) - rewardBefore).to.equal(ethers.parseEther("50"));
      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(ethers.parseEther("9810"));
    });

    it("burn 1000: 1% off burn → 0% burn, 0.5% reward, 0.5% team = 1% fee", async function () {
      await token.connect(user1).burn(ethers.parseEther("1000"));

      const amount = ethers.parseEther("10000");
      const supplyBefore = await token.totalSupply();
      const teamBefore = await token.balanceOf(treasury.address);
      const rewardBefore = await token.balanceOf(REWARD_POOL);
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      // 0% burn, 0.5% team = 50, 0.5% reward = 50, received = 9900
      expect(supplyBefore - await token.totalSupply()).to.equal(0);
      expect((await token.balanceOf(treasury.address)) - teamBefore).to.equal(ethers.parseEther("50"));
      expect((await token.balanceOf(REWARD_POOL)) - rewardBefore).to.equal(ethers.parseEther("50"));
      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(ethers.parseEther("9900"));
    });

    it("burn 5000: 1.5% off → 0% burn, 0% reward, 0.5% team = 0.5% fee", async function () {
      await token.connect(user1).burn(ethers.parseEther("5000"));

      const amount = ethers.parseEther("10000");
      const supplyBefore = await token.totalSupply();
      const teamBefore = await token.balanceOf(treasury.address);
      const rewardBefore = await token.balanceOf(REWARD_POOL);
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      // 0% burn, 0% reward, 0.5% team = 50, received = 9950
      expect(supplyBefore - await token.totalSupply()).to.equal(0);
      expect((await token.balanceOf(treasury.address)) - teamBefore).to.equal(ethers.parseEther("50"));
      expect((await token.balanceOf(REWARD_POOL)) - rewardBefore).to.equal(0);
      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(ethers.parseEther("9950"));
    });

    it("burn 10000: 2% off → 0% everything = free trading", async function () {
      await token.connect(user1).burn(ethers.parseEther("10000"));

      const amount = ethers.parseEther("10000");
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      // 0% fee, received = 10000
      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(amount);
    });
  });

  describe("Pool Management", function () {
    let token;

    beforeEach(async function () {
      token = await setupClawToken(null);
    });

    it("should allow owner to set pools", async function () {
      await token.setPool(user1.address, true);
      expect(await token.isPool(user1.address)).to.be.true;
    });

    it("should allow owner to remove pools", async function () {
      await token.setPool(user1.address, true);
      await token.setPool(user1.address, false);
      expect(await token.isPool(user1.address)).to.be.false;
    });

    it("should reject setPool from non-owner", async function () {
      await expect(
        token.connect(user1).setPool(user2.address, true)
      ).to.be.revertedWithCustomError(token, "OnlyOwner");
    });

    it("should reject setPool after renounce", async function () {
      await token.renounceOwnership();
      await expect(
        token.setPool(user1.address, true)
      ).to.be.revertedWithCustomError(token, "OnlyOwner");
    });
  });

  describe("Batch Airdrop", function () {
    beforeEach(async function () {
      await claimManager.initToken(TICK, MAX_SUPPLY);
    });

    it("should airdrop tokens to multiple wallets", async function () {
      const wallets = [user1.address, user2.address];
      const amounts = [ethers.parseEther("1000"), ethers.parseEther("2000")];

      await claimManager.connect(treasury).batchAirdrop(TICK, wallets, amounts);

      const tokenAddr = await factory.getToken(TICK);
      const token = await ethers.getContractAt("MBC20Token", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);
    });

    it("should mint delta if wallet already claimed", async function () {
      const claimAmount = ethers.parseEther("500");
      const sig = await signClaim(user1.address, TICK, claimAmount, 0n);
      await claimManager.connect(user1).claim(TICK, claimAmount, 0n, sig, { value: CLAIM_FEE });

      const wallets = [user1.address];
      const amounts = [ethers.parseEther("1000")];
      await claimManager.connect(treasury).batchAirdrop(TICK, wallets, amounts);

      const tokenAddr = await factory.getToken(TICK);
      const token = await ethers.getContractAt("MBC20Token", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("should skip wallets that already have >= airdrop amount", async function () {
      const claimAmount = ethers.parseEther("1000");
      const sig = await signClaim(user1.address, TICK, claimAmount, 0n);
      await claimManager.connect(user1).claim(TICK, claimAmount, 0n, sig, { value: CLAIM_FEE });

      const wallets = [user1.address];
      const amounts = [ethers.parseEther("500")];
      await claimManager.connect(treasury).batchAirdrop(TICK, wallets, amounts);

      const tokenAddr = await factory.getToken(TICK);
      const token = await ethers.getContractAt("MBC20Token", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(claimAmount);
    });

    it("should reject if caller is not treasury", async function () {
      await expect(
        claimManager.connect(user1).batchAirdrop(TICK, [user2.address], [ethers.parseEther("100")])
      ).to.be.revertedWithCustomError(claimManager, "OnlyTreasury");
    });

    it("should reject if arrays have different lengths", async function () {
      await expect(
        claimManager.connect(treasury).batchAirdrop(TICK, [user1.address, user2.address], [ethers.parseEther("100")])
      ).to.be.revertedWithCustomError(claimManager, "LengthMismatch");
    });

    it("should reject for non-existent token", async function () {
      await expect(
        claimManager.connect(treasury).batchAirdrop("FAKE", [user1.address], [ethers.parseEther("100")])
      ).to.be.revertedWithCustomError(claimManager, "TokenNotFound");
    });
  });

  describe("Marketplace — USDC orders", function () {
    let token, tokenAddr, usdcAddr;
    const mpAddr = () => marketplace.getAddress();

    beforeEach(async function () {
      token = await setupClawToken(ethers.parseEther("100000"));
      tokenAddr = await factory.getToken(TICK);
      usdcAddr = await mockUsdc.getAddress();
      await token.setPool(await mpAddr(), true);
    });

    it("should list tokens with 2% sell fee deducted", async function () {
      const amount = ethers.parseEther("1000");
      const price = ethers.parseEther("0.05");

      await token.connect(user1).approve(await mpAddr(), amount);
      await marketplace.connect(user1).list(tokenAddr, amount, price, usdcAddr);

      const order = await marketplace.orders(0);
      expect(order.seller).to.equal(user1.address);
      expect(order.amount).to.equal(ethers.parseEther("980"));
      expect(order.pricePerToken).to.equal(price);
      expect(order.paymentToken).to.equal(usdcAddr);
      expect(order.active).to.be.true;
    });

    it("should allow buying with 2% buy fee on transfer", async function () {
      const listAmount = ethers.parseEther("1000");
      const price = ethers.parseEther("0.05");

      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, price, usdcAddr);

      const buyAmount = ethers.parseEther("980");
      const totalUsdc = (buyAmount * price) / ethers.parseEther("1");

      await mockUsdc.connect(user2).approve(await mpAddr(), totalUsdc);
      await marketplace.connect(user2).buy(0, buyAmount);

      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("960.4"));
      const order = await marketplace.orders(0);
      expect(order.active).to.be.false;
    });

    it("should send full USDC to seller (no USDC fee)", async function () {
      const listAmount = ethers.parseEther("1000");
      const price = ethers.parseEther("1");

      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, price, usdcAddr);

      const buyAmount = ethers.parseEther("980");
      const totalUsdc = (buyAmount * price) / ethers.parseEther("1");

      const sellerUsdcBefore = await mockUsdc.balanceOf(user1.address);
      await mockUsdc.connect(user2).approve(await mpAddr(), totalUsdc);
      await marketplace.connect(user2).buy(0, buyAmount);
      const sellerUsdcAfter = await mockUsdc.balanceOf(user1.address);

      expect(sellerUsdcAfter - sellerUsdcBefore).to.equal(totalUsdc);
    });

    it("should burn 1% + send 0.5% team + 0.5% reward on list", async function () {
      const listAmount = ethers.parseEther("10000");
      const price = ethers.parseEther("0.01");

      const supplyBefore = await token.totalSupply();
      const teamBefore = await token.balanceOf(treasury.address);
      const rewardBefore = await token.balanceOf(REWARD_POOL);

      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, price, usdcAddr);

      expect(supplyBefore - await token.totalSupply()).to.equal(ethers.parseEther("100"));
      expect((await token.balanceOf(treasury.address)) - teamBefore).to.equal(ethers.parseEther("50"));
      expect((await token.balanceOf(REWARD_POOL)) - rewardBefore).to.equal(ethers.parseEther("50"));
    });

    it("should allow seller to cancel and get remaining tokens back", async function () {
      const listAmount = ethers.parseEther("1000");
      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, ethers.parseEther("0.05"), usdcAddr);

      const balBefore = await token.balanceOf(user1.address);
      await marketplace.connect(user1).cancel(0);
      const balAfter = await token.balanceOf(user1.address);

      expect(balAfter - balBefore).to.equal(ethers.parseEther("960.4"));
      expect((await marketplace.orders(0)).active).to.be.false;
    });

    it("should reject cancel from non-seller", async function () {
      await token.connect(user1).approve(await mpAddr(), ethers.parseEther("1000"));
      await marketplace.connect(user1).list(tokenAddr, ethers.parseEther("1000"), ethers.parseEther("0.05"), usdcAddr);
      await expect(marketplace.connect(user2).cancel(0)).to.be.revertedWithCustomError(marketplace, "NotSeller");
    });

    it("should reject buying from cancelled order", async function () {
      await token.connect(user1).approve(await mpAddr(), ethers.parseEther("1000"));
      await marketplace.connect(user1).list(tokenAddr, ethers.parseEther("1000"), ethers.parseEther("0.05"), usdcAddr);
      await marketplace.connect(user1).cancel(0);
      await expect(marketplace.connect(user2).buy(0, ethers.parseEther("100"))).to.be.revertedWithCustomError(marketplace, "OrderNotActive");
    });

    it("should reject buying more than available", async function () {
      await token.connect(user1).approve(await mpAddr(), ethers.parseEther("1000"));
      await marketplace.connect(user1).list(tokenAddr, ethers.parseEther("1000"), ethers.parseEther("0.05"), usdcAddr);
      await expect(marketplace.connect(user2).buy(0, ethers.parseEther("981"))).to.be.revertedWithCustomError(marketplace, "InsufficientOrderAmount");
    });

    it("should reject ETH sent on USDC order", async function () {
      await token.connect(user1).approve(await mpAddr(), ethers.parseEther("1000"));
      await marketplace.connect(user1).list(tokenAddr, ethers.parseEther("1000"), ethers.parseEther("0.05"), usdcAddr);
      await expect(
        marketplace.connect(user2).buy(0, ethers.parseEther("100"), { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(marketplace, "NoETHExpected");
    });

    it("should reject invalid payment token", async function () {
      await token.connect(user1).approve(await mpAddr(), ethers.parseEther("1000"));
      await expect(
        marketplace.connect(user1).list(tokenAddr, ethers.parseEther("1000"), ethers.parseEther("0.05"), user2.address)
      ).to.be.revertedWithCustomError(marketplace, "InvalidPaymentToken");
    });
  });

  describe("Marketplace — ETH orders", function () {
    let token, tokenAddr;
    const mpAddr = () => marketplace.getAddress();
    const ETH = ethers.ZeroAddress;

    beforeEach(async function () {
      token = await setupClawToken(ethers.parseEther("100000"));
      tokenAddr = await factory.getToken(TICK);
      await token.setPool(await mpAddr(), true);
    });

    it("should list tokens for ETH payment", async function () {
      const amount = ethers.parseEther("1000");
      const price = ethers.parseEther("0.001"); // 0.001 ETH per CLAW

      await token.connect(user1).approve(await mpAddr(), amount);
      await marketplace.connect(user1).list(tokenAddr, amount, price, ETH);

      const order = await marketplace.orders(0);
      expect(order.seller).to.equal(user1.address);
      expect(order.amount).to.equal(ethers.parseEther("980")); // 2% sell fee
      expect(order.paymentToken).to.equal(ETH);
    });

    it("should allow buying with ETH", async function () {
      const listAmount = ethers.parseEther("1000");
      const price = ethers.parseEther("0.001");

      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, price, ETH);

      // Order has 980 tokens. Buy all. Cost = 980 * 0.001 = 0.98 ETH
      const buyAmount = ethers.parseEther("980");
      const totalETH = (buyAmount * price) / ethers.parseEther("1");

      await marketplace.connect(user2).buy(0, buyAmount, { value: totalETH });

      // Buyer receives 980 - 2% = 960.4
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("960.4"));
    });

    it("should send ETH to seller", async function () {
      const listAmount = ethers.parseEther("1000");
      const price = ethers.parseEther("0.001");

      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, price, ETH);

      const buyAmount = ethers.parseEther("980");
      const totalETH = (buyAmount * price) / ethers.parseEther("1");

      const sellerBefore = await ethers.provider.getBalance(user1.address);
      await marketplace.connect(user2).buy(0, buyAmount, { value: totalETH });
      const sellerAfter = await ethers.provider.getBalance(user1.address);

      expect(sellerAfter - sellerBefore).to.equal(totalETH);
    });

    it("should refund excess ETH to buyer", async function () {
      const listAmount = ethers.parseEther("1000");
      const price = ethers.parseEther("0.001");

      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, price, ETH);

      const buyAmount = ethers.parseEther("980");
      const totalETH = (buyAmount * price) / ethers.parseEther("1"); // 0.98 ETH
      const overpay = ethers.parseEther("2"); // send 2 ETH

      const buyerBefore = await ethers.provider.getBalance(user2.address);
      const tx = await marketplace.connect(user2).buy(0, buyAmount, { value: overpay });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const buyerAfter = await ethers.provider.getBalance(user2.address);

      // Buyer should only spend totalETH + gas, excess refunded
      expect(buyerBefore - buyerAfter - gasCost).to.equal(totalETH);
    });

    it("should reject insufficient ETH", async function () {
      const listAmount = ethers.parseEther("1000");
      const price = ethers.parseEther("0.001");

      await token.connect(user1).approve(await mpAddr(), listAmount);
      await marketplace.connect(user1).list(tokenAddr, listAmount, price, ETH);

      await expect(
        marketplace.connect(user2).buy(0, ethers.parseEther("980"), { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });
  });
});
