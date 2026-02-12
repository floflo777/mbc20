const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MBC-20 V2 Protocol", function () {
  let claimManagerV2, factoryV2, marketplace, clawToken;
  let deployer, signer, user1, user2, tokenDeployer;

  const TICK = "TEST";
  const MAX_SUPPLY = ethers.parseEther("1000000"); // 1M
  const DEPLOYMENT_COST = ethers.parseEther("100"); // 100 CLAW
  const CLAW_MAX = ethers.parseEther("21000000");

  beforeEach(async function () {
    [deployer, signer, user1, user2, tokenDeployer] = await ethers.getSigners();

    // Deploy CLAW (V1 token) as the burn currency
    // We use MBC20Token as a simple ERC20 for CLAW (minter = deployer for testing)
    const MBC20Token = await ethers.getContractFactory("MBC20Token");
    clawToken = await MBC20Token.deploy(
      "mbc-20: CLAW", "CLAW", CLAW_MAX,
      deployer.address, // minter
      ethers.ZeroAddress, // teamWallet (not needed)
      ethers.ZeroAddress, // rewardPool (not needed)
      deployer.address   // owner
    );
    await clawToken.waitForDeployment();

    // Mint CLAW to tokenDeployer (they need it to deploy tokens)
    await clawToken.mint(tokenDeployer.address, ethers.parseEther("10000"));
    // Mint CLAW to user1 for testing
    await clawToken.mint(user1.address, ethers.parseEther("5000"));

    // Predict FactoryV2 address
    const nonce = await deployer.getNonce();
    const futureFactory = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 1 });

    // Deploy ClaimManagerV2
    const ClaimManagerV2 = await ethers.getContractFactory("ClaimManagerV2");
    claimManagerV2 = await ClaimManagerV2.deploy(futureFactory, signer.address);
    await claimManagerV2.waitForDeployment();

    // Deploy FactoryV2
    const FactoryV2 = await ethers.getContractFactory("MBC20FactoryV2");
    factoryV2 = await FactoryV2.deploy(
      await claimManagerV2.getAddress(),
      await clawToken.getAddress(),
      DEPLOYMENT_COST
    );
    await factoryV2.waitForDeployment();

    // Deploy Marketplace (reuse V1)
    const MockERC20 = await ethers.getContractFactory("MBC20Token");
    const mockUsdc = await MockERC20.deploy(
      "USD Coin", "USDC", ethers.MaxUint256,
      deployer.address, ethers.ZeroAddress, ethers.ZeroAddress, deployer.address
    );
    const Marketplace = await ethers.getContractFactory("MBC20Marketplace");
    marketplace = await Marketplace.deploy(await mockUsdc.getAddress());
    await marketplace.waitForDeployment();
  });

  async function signClaimV2(wallet, tick, totalAmount, nonce) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "string", "uint256", "uint256", "uint256"],
      [wallet, tick, totalAmount, nonce, chainId]
    );
    return signer.signMessage(ethers.getBytes(messageHash));
  }

  async function deployTestToken() {
    // Approve CLAW burn
    await clawToken.connect(tokenDeployer).approve(
      await factoryV2.getAddress(), DEPLOYMENT_COST
    );
    // Deploy token
    await factoryV2.connect(tokenDeployer).createToken(TICK, MAX_SUPPLY);
    const tokenAddr = await factoryV2.getToken(TICK);
    return ethers.getContractAt("MBC20TokenV2", tokenAddr);
  }

  // ═══════════════════ Factory V2 ═══════════════════

  describe("Permissionless Token Deployment", function () {
    it("should deploy a token by burning CLAW", async function () {
      const clawBefore = await clawToken.balanceOf(tokenDeployer.address);

      await clawToken.connect(tokenDeployer).approve(
        await factoryV2.getAddress(), DEPLOYMENT_COST
      );
      await factoryV2.connect(tokenDeployer).createToken(TICK, MAX_SUPPLY);

      const clawAfter = await clawToken.balanceOf(tokenDeployer.address);
      expect(clawBefore - clawAfter).to.equal(DEPLOYMENT_COST);

      const tokenAddr = await factoryV2.getToken(TICK);
      expect(tokenAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("should set deployer as fee recipient", async function () {
      const token = await deployTestToken();
      expect(await token.deployer()).to.equal(tokenDeployer.address);
    });

    it("should set claimManager as minter", async function () {
      const token = await deployTestToken();
      expect(await token.minter()).to.equal(await claimManagerV2.getAddress());
    });

    it("should set deployer as token owner", async function () {
      const token = await deployTestToken();
      expect(await token.owner()).to.equal(tokenDeployer.address);
    });

    it("should reject duplicate token creation", async function () {
      await deployTestToken();

      await clawToken.connect(tokenDeployer).approve(
        await factoryV2.getAddress(), DEPLOYMENT_COST
      );
      await expect(
        factoryV2.connect(tokenDeployer).createToken(TICK, MAX_SUPPLY)
      ).to.be.revertedWithCustomError(factoryV2, "TokenAlreadyExists");
    });

    it("should track token in allTokens array", async function () {
      const token = await deployTestToken();
      expect(await factoryV2.totalTokens()).to.equal(1);
      expect(await factoryV2.allTokens(0)).to.equal(await token.getAddress());
    });

    it("should store correct tokenInfo", async function () {
      await deployTestToken();
      const tickHash = ethers.keccak256(ethers.toUtf8Bytes(TICK));
      const info = await factoryV2.tokenInfo(tickHash);
      expect(info.deployer).to.equal(tokenDeployer.address);
      expect(info.maxSupply).to.equal(MAX_SUPPLY);
      expect(info.clawBurned).to.equal(DEPLOYMENT_COST);
    });

    it("should emit TokenCreated event", async function () {
      await clawToken.connect(tokenDeployer).approve(
        await factoryV2.getAddress(), DEPLOYMENT_COST
      );
      await expect(factoryV2.connect(tokenDeployer).createToken(TICK, MAX_SUPPLY))
        .to.emit(factoryV2, "TokenCreated");
    });

    it("should allow zero-cost deployment if admin sets cost to 0", async function () {
      await factoryV2.setDeploymentCost(0);

      // No approval needed
      await factoryV2.connect(user1).createToken("FREE", MAX_SUPPLY);
      const tokenAddr = await factoryV2.getToken("FREE");
      expect(tokenAddr).to.not.equal(ethers.ZeroAddress);
    });
  });

  // ═══════════════════ Admin ═══════════════════

  describe("Factory Admin", function () {
    it("should allow admin to update deployment cost", async function () {
      const newCost = ethers.parseEther("500");
      await factoryV2.setDeploymentCost(newCost);
      expect(await factoryV2.deploymentCost()).to.equal(newCost);
    });

    it("should reject non-admin from updating cost", async function () {
      await expect(
        factoryV2.connect(user1).setDeploymentCost(0)
      ).to.be.revertedWithCustomError(factoryV2, "OnlyAdmin");
    });

    it("should allow admin to renounce", async function () {
      await factoryV2.renounceAdmin();
      expect(await factoryV2.admin()).to.equal(ethers.ZeroAddress);
    });

    it("should reject cost update after renounce", async function () {
      await factoryV2.renounceAdmin();
      await expect(
        factoryV2.setDeploymentCost(0)
      ).to.be.revertedWithCustomError(factoryV2, "OnlyAdmin");
    });
  });

  // ═══════════════════ Claiming V2 ═══════════════════

  describe("Claiming (no ETH fee)", function () {
    beforeEach(async function () {
      await deployTestToken();
    });

    it("should claim tokens with valid signature (no fee)", async function () {
      const amount = ethers.parseEther("1000");
      const sig = await signClaimV2(user1.address, TICK, amount, 0n);
      await claimManagerV2.connect(user1).claim(TICK, amount, 0n, sig);

      const tokenAddr = await factoryV2.getToken(TICK);
      const token = await ethers.getContractAt("MBC20TokenV2", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("should use per-wallet per-token nonces", async function () {
      // Claim for TICK
      const amount = ethers.parseEther("1000");
      const sig = await signClaimV2(user1.address, TICK, amount, 0n);
      await claimManagerV2.connect(user1).claim(TICK, amount, 0n, sig);

      // Nonce for TICK should be 1
      const tickHash = ethers.keccak256(ethers.toUtf8Bytes(TICK));
      expect(await claimManagerV2.nonces(user1.address, tickHash)).to.equal(1n);
    });

    it("should claim delta on second claim", async function () {
      const amount1 = ethers.parseEther("1000");
      const sig1 = await signClaimV2(user1.address, TICK, amount1, 0n);
      await claimManagerV2.connect(user1).claim(TICK, amount1, 0n, sig1);

      const amount2 = ethers.parseEther("2500");
      const sig2 = await signClaimV2(user1.address, TICK, amount2, 1n);
      await claimManagerV2.connect(user1).claim(TICK, amount2, 1n, sig2);

      const tokenAddr = await factoryV2.getToken(TICK);
      const token = await ethers.getContractAt("MBC20TokenV2", tokenAddr);
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
        claimManagerV2.connect(user1).claim(TICK, amount, 0n, badSig)
      ).to.be.revertedWithCustomError(claimManagerV2, "InvalidSignature");
    });

    it("should reject wrong nonce", async function () {
      const amount = ethers.parseEther("1000");
      const sig = await signClaimV2(user1.address, TICK, amount, 1n);
      await expect(
        claimManagerV2.connect(user1).claim(TICK, amount, 1n, sig)
      ).to.be.revertedWithCustomError(claimManagerV2, "InvalidNonce");
    });

    it("should reject claim for non-existent token", async function () {
      const amount = ethers.parseEther("1000");
      const sig = await signClaimV2(user1.address, "FAKE", amount, 0n);
      await expect(
        claimManagerV2.connect(user1).claim("FAKE", amount, 0n, sig)
      ).to.be.revertedWithCustomError(claimManagerV2, "TokenNotFound");
    });
  });

  // ═══════════════════ Batch Airdrop V2 ═══════════════════

  describe("Batch Airdrop (deployer-only)", function () {
    beforeEach(async function () {
      await deployTestToken();
    });

    it("should allow deployer to airdrop", async function () {
      const wallets = [user1.address, user2.address];
      const amounts = [ethers.parseEther("1000"), ethers.parseEther("2000")];

      await claimManagerV2.connect(tokenDeployer).batchAirdrop(TICK, wallets, amounts);

      const tokenAddr = await factoryV2.getToken(TICK);
      const token = await ethers.getContractAt("MBC20TokenV2", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);
    });

    it("should reject airdrop from non-deployer", async function () {
      await expect(
        claimManagerV2.connect(user1).batchAirdrop(TICK, [user2.address], [ethers.parseEther("100")])
      ).to.be.revertedWithCustomError(claimManagerV2, "OnlyDeployer");
    });

    it("should mint delta if wallet already claimed", async function () {
      // Claim first
      const claimAmount = ethers.parseEther("500");
      const sig = await signClaimV2(user1.address, TICK, claimAmount, 0n);
      await claimManagerV2.connect(user1).claim(TICK, claimAmount, 0n, sig);

      // Airdrop more
      await claimManagerV2.connect(tokenDeployer).batchAirdrop(
        TICK, [user1.address], [ethers.parseEther("1000")]
      );

      const tokenAddr = await factoryV2.getToken(TICK);
      const token = await ethers.getContractAt("MBC20TokenV2", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("should skip wallets already at or above airdrop amount", async function () {
      const claimAmount = ethers.parseEther("1000");
      const sig = await signClaimV2(user1.address, TICK, claimAmount, 0n);
      await claimManagerV2.connect(user1).claim(TICK, claimAmount, 0n, sig);

      await claimManagerV2.connect(tokenDeployer).batchAirdrop(
        TICK, [user1.address], [ethers.parseEther("500")]
      );

      const tokenAddr = await factoryV2.getToken(TICK);
      const token = await ethers.getContractAt("MBC20TokenV2", tokenAddr);
      expect(await token.balanceOf(user1.address)).to.equal(claimAmount);
    });

    it("should reject mismatched arrays", async function () {
      await expect(
        claimManagerV2.connect(tokenDeployer).batchAirdrop(
          TICK, [user1.address, user2.address], [ethers.parseEther("100")]
        )
      ).to.be.revertedWithCustomError(claimManagerV2, "LengthMismatch");
    });
  });

  // ═══════════════════ Token V2 Trading Fees ═══════════════════

  describe("V2 Trading Fees (1% burn + 1% deployer)", function () {
    let token;

    beforeEach(async function () {
      token = await deployTestToken();

      // Airdrop tokens to user1 for testing
      await claimManagerV2.connect(tokenDeployer).batchAirdrop(
        TICK, [user1.address], [ethers.parseEther("100000")]
      );

      // Set user2 as pool
      await token.connect(tokenDeployer).setPool(user2.address, true);
    });

    it("should charge 2% fee on sells (1% burn + 1% deployer)", async function () {
      const amount = ethers.parseEther("10000");

      const supplyBefore = await token.totalSupply();
      const deployerBefore = await token.balanceOf(tokenDeployer.address);
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      const supplyAfter = await token.totalSupply();
      const deployerAfter = await token.balanceOf(tokenDeployer.address);
      const poolAfter = await token.balanceOf(user2.address);

      // 1% burn = 100, 1% deployer = 100, received = 9800
      expect(supplyBefore - supplyAfter).to.equal(ethers.parseEther("100"));
      expect(deployerAfter - deployerBefore).to.equal(ethers.parseEther("100"));
      expect(poolAfter - poolBefore).to.equal(ethers.parseEther("9800"));
    });

    it("should charge 2% fee on buys", async function () {
      // Give pool tokens first
      await token.connect(user1).transfer(user2.address, ethers.parseEther("5000"));

      // Buy: pool -> deployer
      const buyAmount = ethers.parseEther("1000");
      const receiverBefore = await token.balanceOf(deployer.address);
      await token.connect(user2).transfer(deployer.address, buyAmount);
      const receiverAfter = await token.balanceOf(deployer.address);

      // Buyer receives 980 (1000 - 2%)
      expect(receiverAfter - receiverBefore).to.equal(ethers.parseEther("980"));
    });

    it("should NOT charge fees on wallet-to-wallet transfers", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(user1).transfer(deployer.address, amount);
      expect(await token.balanceOf(deployer.address)).to.equal(amount);
    });
  });

  // ═══════════════════ V2 Burn Discount ═══════════════════

  describe("V2 Burn Discount (reduction: burn -> deployer)", function () {
    let token;

    beforeEach(async function () {
      token = await deployTestToken();

      await claimManagerV2.connect(tokenDeployer).batchAirdrop(
        TICK, [user1.address], [ethers.parseEther("100000")]
      );

      await token.connect(tokenDeployer).setPool(user2.address, true);
    });

    it("burn 100: 0.1% off burn -> 0.9% burn, 1% deployer = 1.9% fee", async function () {
      await token.connect(user1).burn(ethers.parseEther("100"));

      const amount = ethers.parseEther("10000");
      const supplyBefore = await token.totalSupply();
      const deployerBefore = await token.balanceOf(tokenDeployer.address);
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      // 0.9% burn = 90, 1% deployer = 100, received = 9810
      expect(supplyBefore - await token.totalSupply()).to.equal(ethers.parseEther("90"));
      expect((await token.balanceOf(tokenDeployer.address)) - deployerBefore).to.equal(ethers.parseEther("100"));
      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(ethers.parseEther("9810"));
    });

    it("burn 1000: 1% off -> 0% burn, 1% deployer = 1% fee", async function () {
      await token.connect(user1).burn(ethers.parseEther("1000"));

      const amount = ethers.parseEther("10000");
      const supplyBefore = await token.totalSupply();
      const deployerBefore = await token.balanceOf(tokenDeployer.address);
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      // 0% burn, 1% deployer = 100, received = 9900
      expect(supplyBefore - await token.totalSupply()).to.equal(0);
      expect((await token.balanceOf(tokenDeployer.address)) - deployerBefore).to.equal(ethers.parseEther("100"));
      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(ethers.parseEther("9900"));
    });

    it("burn 5000: 1.5% off -> 0% burn, 0.5% deployer = 0.5% fee", async function () {
      await token.connect(user1).burn(ethers.parseEther("5000"));

      const amount = ethers.parseEther("10000");
      const supplyBefore = await token.totalSupply();
      const deployerBefore = await token.balanceOf(tokenDeployer.address);
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      // 0% burn, 0.5% deployer = 50, received = 9950
      expect(supplyBefore - await token.totalSupply()).to.equal(0);
      expect((await token.balanceOf(tokenDeployer.address)) - deployerBefore).to.equal(ethers.parseEther("50"));
      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(ethers.parseEther("9950"));
    });

    it("burn 10000: 2% off -> 0% everything = free trading", async function () {
      await token.connect(user1).burn(ethers.parseEther("10000"));

      const amount = ethers.parseEther("10000");
      const poolBefore = await token.balanceOf(user2.address);

      await token.connect(user1).transfer(user2.address, amount);

      expect((await token.balanceOf(user2.address)) - poolBefore).to.equal(amount);
    });
  });

  // ═══════════════════ Pool Management ═══════════════════

  describe("V2 Pool Management", function () {
    let token;

    beforeEach(async function () {
      token = await deployTestToken();
    });

    it("should allow token owner (deployer) to set pools", async function () {
      await token.connect(tokenDeployer).setPool(user1.address, true);
      expect(await token.isPool(user1.address)).to.be.true;
    });

    it("should reject setPool from non-owner", async function () {
      await expect(
        token.connect(user1).setPool(user2.address, true)
      ).to.be.revertedWithCustomError(token, "OnlyOwner");
    });

    it("should allow owner to renounce ownership", async function () {
      await token.connect(tokenDeployer).renounceOwnership();
      expect(await token.owner()).to.equal(ethers.ZeroAddress);
    });

    it("should reject setPool after renounce", async function () {
      await token.connect(tokenDeployer).renounceOwnership();
      await expect(
        token.connect(tokenDeployer).setPool(user1.address, true)
      ).to.be.revertedWithCustomError(token, "OnlyOwner");
    });
  });

  // ═══════════════════ Marketplace Compatibility ═══════════════════

  describe("V2 + Marketplace", function () {
    let token, tokenAddr;

    beforeEach(async function () {
      token = await deployTestToken();
      tokenAddr = await token.getAddress();

      await claimManagerV2.connect(tokenDeployer).batchAirdrop(
        TICK, [user1.address], [ethers.parseEther("100000")]
      );

      await token.connect(tokenDeployer).setPool(await marketplace.getAddress(), true);
    });

    it("should list with 2% sell fee deducted", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(user1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(user1).list(
        tokenAddr, amount, ethers.parseEther("0.05"), ethers.ZeroAddress
      );

      const order = await marketplace.orders(0);
      expect(order.amount).to.equal(ethers.parseEther("980")); // 2% fee
    });

    it("should send 1% to deployer on listing", async function () {
      const amount = ethers.parseEther("10000");
      const deployerBefore = await token.balanceOf(tokenDeployer.address);

      await token.connect(user1).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(user1).list(
        tokenAddr, amount, ethers.parseEther("0.01"), ethers.ZeroAddress
      );

      const deployerAfter = await token.balanceOf(tokenDeployer.address);
      expect(deployerAfter - deployerBefore).to.equal(ethers.parseEther("100"));
    });
  });
});
