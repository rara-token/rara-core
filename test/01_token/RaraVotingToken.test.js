const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const RaraVotingToken = artifacts.require('RaraVotingToken');
const MockVotingMembershipListener = artifacts.require('MockVotingMembershipListener');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('RaraVotingToken', ([alice, bob, carol, dave, edith, minter, manager, pauser]) => {
    const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
    const PAUSER_ROLE = web3.utils.soliditySha3('PAUSER_ROLE');

    const requirements = [0, 30, 500, 5000];

    beforeEach(async () => {
      this.rara = await MockERC20.new('Token', 'T', '10000000000', { from: minter });
      await this.rara.transfer(alice, 10000, { from:minter });
      await this.rara.transfer(bob, 10000, { from:minter });
      await this.rara.transfer(carol, 10000, { from:minter });
      await this.rara.transfer(dave, 10000, { from:minter });
      await this.rara.transfer(edith, 10000, { from:minter });
      this.listener = await MockVotingMembershipListener.new();
      this.token = await RaraVotingToken.new(requirements, this.rara.address, this.listener.address);
      await this.token.grantRole(MANAGER_ROLE, manager, { from:alice });
      await this.token.grantRole(PAUSER_ROLE, pauser, { from:alice });
    });

    it('should have correct name and symbol and decimal', async () => {
      const { token } = this;
      const name = await token.name();
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      assert.equal(name.valueOf(), 'Rara Voting Token');
      assert.equal(symbol.valueOf(), 'vRARA');
      assert.equal(decimals.valueOf(), '8');
    });

    it('should have state set by constructor', async () => {
      const { rara, listener, token } = this;
      assert.equal((await token.rara()).valueOf(), rara.address);
      assert.equal((await token.listener()).valueOf(), listener.address);
      assert.equal((await token.membershipLevels()).valueOf(), '4');
      assert.equal((await token.membershipRequirement(0)).valueOf(), '0');
      assert.equal((await token.membershipRequirement(1)).valueOf(), '30');
      assert.equal((await token.membershipRequirement(2)).valueOf(), '500');
      assert.equal((await token.membershipRequirement(3)).valueOf(), '5000');
    });

    it('mint() should allow minting by staking Rara', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 500, { from:alice });
      await rara.approve(token.address, 200, { from:bob });

      await token.mint(100, { from:alice });
      assert.equal((await rara.balanceOf(alice)).valueOf(), '9900');
      assert.equal((await rara.balanceOf(token.address)).valueOf(), '100');
      assert.equal((await token.balanceOf(alice)).valueOf(), '100');
      assert.equal((await token.totalSupply()).valueOf(), '100');

      await token.mint(250, { from:alice });
      assert.equal((await rara.balanceOf(alice)).valueOf(), '9650');
      assert.equal((await rara.balanceOf(token.address)).valueOf(), '350');
      assert.equal((await token.balanceOf(alice)).valueOf(), '350');
      assert.equal((await token.totalSupply()).valueOf(), '350');

      await token.mint(150, { from:bob });
      assert.equal((await rara.balanceOf(alice)).valueOf(), '9650');
      assert.equal((await rara.balanceOf(bob)).valueOf(), '9850');
      assert.equal((await rara.balanceOf(token.address)).valueOf(), '500');
      assert.equal((await token.balanceOf(alice)).valueOf(), '350');
      assert.equal((await token.balanceOf(bob)).valueOf(), '150');
      assert.equal((await token.totalSupply()).valueOf(), '500');
    });

    it('mint() should revert for insufficient balance or allowance', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 500, { from:alice });
      await rara.approve(token.address, 100000, { from:bob });

      await expectRevert.unspecified(token.mint(600, { from:alice }));
      await expectRevert.unspecified(token.mint(50000, { from:bob }));
    });

    // TODO test mintWithPermit

    it('burn() should remove tokens and return Rara', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 1000, { from:alice });
      await rara.approve(token.address, 100, { from:bob });
      await token.mint(1000, { from:alice });
      await token.mint(100, { from:bob });

      assert.equal((await rara.balanceOf(alice)).valueOf(), '9000');
      assert.equal((await rara.balanceOf(bob)).valueOf(), '9900');
      assert.equal((await rara.balanceOf(token.address)).valueOf(), '1100');
      assert.equal((await token.balanceOf(alice)).valueOf(), '1000');
      assert.equal((await token.balanceOf(bob)).valueOf(), '100');
      assert.equal((await token.totalSupply()).valueOf(), '1100');

      await token.burn(450, { from:alice });
      assert.equal((await rara.balanceOf(alice)).valueOf(), '9450');
      assert.equal((await rara.balanceOf(bob)).valueOf(), '9900');
      assert.equal((await rara.balanceOf(token.address)).valueOf(), '650');
      assert.equal((await token.balanceOf(alice)).valueOf(), '550');
      assert.equal((await token.balanceOf(bob)).valueOf(), '100');
      assert.equal((await token.totalSupply()).valueOf(), '650');

      await token.burn(100, { from:bob });
      assert.equal((await rara.balanceOf(alice)).valueOf(), '9450');
      assert.equal((await rara.balanceOf(bob)).valueOf(), '10000');
      assert.equal((await rara.balanceOf(token.address)).valueOf(), '550');
      assert.equal((await token.balanceOf(alice)).valueOf(), '550');
      assert.equal((await token.balanceOf(bob)).valueOf(), '0');
      assert.equal((await token.totalSupply()).valueOf(), '550');
    });

    it('burn() should revert for insufficient balance', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 1000, { from:alice });
      await rara.approve(token.address, 100, { from:bob });
      await token.mint(1000, { from:alice });
      await token.mint(100, { from:bob });

      await expectRevert.unspecified(token.burn(1001, { from:alice }));
      await expectRevert.unspecified(token.burn(200, { from:bob }));
    });

    it('delegate() should set vote delegate address', async () => {
      const { rara, token } = this;

      await token.delegate(carol, { from:alice });
      assert.equal((await token.delegates(alice)).valueOf(), carol);
      assert.equal((await token.delegates(bob)).valueOf(), ZERO_ADDRESS);
      assert.equal((await token.delegates(carol)).valueOf(), ZERO_ADDRESS);

      await token.delegate(dave, { from:alice });
      await token.delegate(bob, { from:bob });
      await token.delegate(carol, { from:carol });
      assert.equal((await token.delegates(alice)).valueOf(), dave);
      assert.equal((await token.delegates(bob)).valueOf(), bob);
      assert.equal((await token.delegates(carol)).valueOf(), carol);

      await token.delegate(ZERO_ADDRESS, { from:bob });
      await token.delegate(bob, { from:carol });
      assert.equal((await token.delegates(alice)).valueOf(), dave);
      assert.equal((await token.delegates(bob)).valueOf(), ZERO_ADDRESS);
      assert.equal((await token.delegates(carol)).valueOf(), bob);
    });

    it('delegate() should transfer vRARA vote share to provided address', async () => {
      const { rara, token } = this;

      await rara.approve(token.address, 1000, { from:alice });
      await rara.approve(token.address, 1000, { from:bob });
      await rara.approve(token.address, 1000, { from:carol });

      await token.delegate(carol, { from:alice });

      await token.mint(100, { from:alice });
      await token.mint(200, { from:bob });
      await token.mint(300, { from:carol });

      assert.equal((await token.totalVotes()).valueOf(), '600');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '100');

      await token.delegate(bob, { from:bob });
      await token.delegate(carol, { from:carol });

      assert.equal((await token.totalVotes()).valueOf(), '600');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '200');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '400');

      await token.delegate(alice, { from:alice });
      await token.delegate(ZERO_ADDRESS, { from:bob });

      assert.equal((await token.totalVotes()).valueOf(), '600');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '100');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '300');
    });

    it('getCurrentVotes() should reflect vRARA balance, delegate assignment, and membership level', async () => {
      const { rara, token } = this;

      await rara.approve(token.address, 1000, { from:alice });
      await rara.approve(token.address, 1000, { from:bob });
      await rara.approve(token.address, 1000, { from:carol });

      await token.delegate(carol, { from:alice });

      await token.mint(100, { from:alice });
      await token.mint(200, { from:bob });
      await token.mint(300, { from:carol });

      assert.equal((await token.totalVotes()).valueOf(), '600');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '100');

      await token.delegate(bob, { from:bob });
      await token.delegate(carol, { from:carol });

      assert.equal((await token.totalVotes()).valueOf(), '600');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '200');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '400');

      await token.delegate(alice, { from:alice });
      await token.delegate(ZERO_ADDRESS, { from:bob });

      assert.equal((await token.totalVotes()).valueOf(), '600');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '100');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '300');

      await token.burn(75, { from:alice });
      assert.equal((await token.totalVotes()).valueOf(), '500');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '300');

      await token.mint(5, { from:alice });
      assert.equal((await token.totalVotes()).valueOf(), '530');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '30');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '300');

      await token.delegate(dave, { from:carol });
      await token.burn(200, { from:bob });
      await token.mint(70, { from:alice });
      assert.equal((await token.totalVotes()).valueOf(), '400');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '100');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(dave)).valueOf(), '300');

      await token.mint(25, { from:alice });
      await token.mint(25, { from:bob });
      await token.mint(25, { from:carol });
      assert.equal((await token.totalVotes()).valueOf(), '450');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '125');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(dave)).valueOf(), '325');

      await token.mint(25, { from:alice });
      await token.mint(25, { from:bob });
      await token.mint(25, { from:carol });
      assert.equal((await token.totalVotes()).valueOf(), '550');
      assert.equal((await token.getCurrentVotes(alice)).valueOf(), '150');
      assert.equal((await token.getCurrentVotes(bob)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(carol)).valueOf(), '0');
      assert.equal((await token.getCurrentVotes(dave)).valueOf(), '350');
    });

    it('getCurrentLevel() should appropriately reflect vRARA balance after minting', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 50000, { from:alice });
      await rara.approve(token.address, 50000, { from:bob });

      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '0');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '0');

      await token.mint(30, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '0');

      await token.mint(29, { from:bob });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '0');

      await token.mint(2, { from:bob });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '1');

      await token.mint(470, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '1');

      await token.mint(5000, { from:bob });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '3');

      await token.mint(9500, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '3');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '3');
    });

    it('getCurrentLevel() should appropriately reflect vRARA balance after burning', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 50000, { from:alice });
      await rara.approve(token.address, 50000, { from:bob });

      await token.mint(10000, { from:alice });
      await token.mint(1000, { from:bob });

      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '3');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '2');

      await token.burn(5000, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '3');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '2');

      await token.burn(1, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '2');

      await token.burn(600, { from:bob });  // alice has 4999, bob has 400
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '1');

      await token.burn(375, { from:bob });  // alice has 4999, bob has 25
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '0');

      await token.burn(4994, { from:alice });  // alice has 5, bob has 25
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '0');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '0');
    });

    it('getCurrentLevel() should appropriately reflect vRARA balance after mints and burns', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 50000, { from:alice });
      await rara.approve(token.address, 50000, { from:bob });

      await token.mint(10000, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '3');

      await token.burn(9999, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '0');

      await token.mint(9999, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '3');

      await token.burn(5000, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '3');

      await token.burn(100, { from:alice });  // alice has 4900
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');

      await token.burn(4880, { from:alice });  // alice has 20
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '0');

      await token.mint(20, { from:alice });  // alice has 40
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');

      await token.mint(470, { from:alice });  // alice has 510
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');
    });

    it('should emit membership level events', async () => {
      const { rara, token, listener } = this;
      await rara.approve(token.address, 50000, { from:alice });
      await rara.approve(token.address, 50000, { from:bob });

      let res = await token.mint(10000, { from:alice });
      await expectEvent.inTransaction(res.tx, token, 'MemberAdded', { user:alice });
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberRemoved');
      await expectEvent.inTransaction(res.tx, token, 'MembershipChanged', { user:alice, prevLevel:'0', level:'3' });

      res = await token.burn(9999, { from:alice });
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberAdded');
      await expectEvent.inTransaction(res.tx, token, 'MemberRemoved', { user:alice });
      await expectEvent.inTransaction(res.tx, token, 'MembershipChanged', { user:alice, prevLevel:'3', level:'0' });

      res = await token.mint(9999, { from:alice });
      await expectEvent.inTransaction(res.tx, token, 'MemberAdded', { user:alice });
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberRemoved');
      await expectEvent.inTransaction(res.tx, token, 'MembershipChanged', { user:alice, prevLevel:'0', level:'3' });

      res = await token.burn(5000, { from:alice });
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberAdded');
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberRemoved');
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MembershipChanged');

      res = await token.burn(100, { from:alice });  // alice has 4900
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberAdded');
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberRemoved');
      await expectEvent.inTransaction(res.tx, token, 'MembershipChanged', { user:alice, prevLevel:'3', level:'2' });

      res = await token.burn(4880, { from:alice });  // alice has 20
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberAdded');
      await expectEvent.inTransaction(res.tx, token, 'MemberRemoved', { user:alice });
      await expectEvent.inTransaction(res.tx, token, 'MembershipChanged', { user:alice, prevLevel:'2', level:'0' });

      res = await token.mint(20, { from:alice });  // alice has 40
      await expectEvent.inTransaction(res.tx, token, 'MemberAdded', { user:alice });
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberRemoved');
      await expectEvent.inTransaction(res.tx, token, 'MembershipChanged', { user:alice, prevLevel:'0', level:'1' });

      res = await token.mint(470, { from:alice });  // alice has 510
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberAdded');
      await expectEvent.notEmitted.inTransaction(res.tx, token, 'MemberRemoved');
      await expectEvent.inTransaction(res.tx, token, 'MembershipChanged', { user:alice, prevLevel:'1', level:'2' });
    });

    it('IVotingMembershipListener should receive membership level updates', async () => {
      const { rara, token, listener } = this;
      await rara.approve(token.address, 50000, { from:alice });
      await rara.approve(token.address, 50000, { from:bob });

      let res = await token.mint(10000, { from:alice });
      await expectEvent.inTransaction(res.tx, listener, 'MembershipChanged', { sender:token.address, user:alice, prevLevel:'0', level:'3' });

      res = await token.burn(9999, { from:alice });
      await expectEvent.inTransaction(res.tx, listener, 'MembershipChanged', { sender:token.address, user:alice, prevLevel:'3', level:'0' });

      res = await token.mint(9999, { from:alice });
      await expectEvent.inTransaction(res.tx, listener, 'MembershipChanged', { sender:token.address, user:alice, prevLevel:'0', level:'3' });

      res = await token.burn(5000, { from:alice });
      await expectEvent.notEmitted.inTransaction(res.tx, listener, 'MembershipChanged');

      res = await token.burn(100, { from:alice });  // alice has 4900
      await expectEvent.inTransaction(res.tx, listener, 'MembershipChanged', { sender:token.address, user:alice, prevLevel:'3', level:'2' });

      res = await token.burn(4880, { from:alice });  // alice has 20
      await expectEvent.inTransaction(res.tx, listener, 'MembershipChanged', { sender:token.address, user:alice, prevLevel:'2', level:'0' });

      res = await token.mint(20, { from:alice });  // alice has 40
      await expectEvent.inTransaction(res.tx, listener, 'MembershipChanged', { sender:token.address, user:alice, prevLevel:'0', level:'1' });

      res = await token.mint(470, { from:alice });  // alice has 510
      await expectEvent.inTransaction(res.tx, listener, 'MembershipChanged', { sender:token.address, user:alice, prevLevel:'1', level:'2' });
    });

    it('setMembershipRequirement() should revert for non-manager', async () => {
      const { token } = this;
      await expectRevert(token.setMembershipRequirement([0, 1, 2], { from:bob  }),
          "vRARA::setMembershipRequirement: must have manager role to setMembershipRequirement");
      await expectRevert(token.setMembershipRequirement([0, 1, 2], { from:pauser  }),
          "vRARA::setMembershipRequirement: must have manager role to setMembershipRequirement");
      await token.setMembershipRequirement([0, 1, 2], { from:manager });
      await token.setMembershipRequirement([0, 1, 2], { from:alice });
    });

    it('setMembershipRequirement() should revert for invalid level thresholds', async () => {
      const { token } = this;
      await expectRevert(token.setMembershipRequirement([], { from:manager  }),
          "vRARA::setMembershipRequirement: _requirements must have length > 0");
      await expectRevert(token.setMembershipRequirement([1], { from:manager  }),
          "vRARA::setMembershipRequirement: _requirements[0] must be 0");
      await expectRevert(token.setMembershipRequirement([0, 1, 0], { from:manager  }),
          "vRARA::setMembershipRequirement: _requirements elements must monotonically increase");
      await expectRevert(token.setMembershipRequirement([0, 0, 1000, 999], { from:manager  }),
          "vRARA::setMembershipRequirement: _requirements elements must monotonically increase");
      await token.setMembershipRequirement([0, 0, 1, 1, 2, 3, 5, 8, 13], { from:manager });
    });

    it('setMembershipRequirement() should alter mint/burn behavior w.r.t. membership levels', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 50000, { from:alice });
      await rara.approve(token.address, 50000, { from:bob });

      await token.setMembershipRequirement([0, 0, 100, 300, 1000], { from:manager })

      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '0');
      await token.massUpdateMemberships([alice]);
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');

      await token.mint(10000, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '4');

      await token.burn(9999, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');

      await token.burn(1, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');

      await token.mint(299, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');

      await token.burn(199, { from:alice });
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');

      await token.burn(51, { from:alice });   // alice has 49
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');

      await token.mint(251, { from:alice });   // alice has 300
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '3');

      await token.mint(1000, { from:alice });  // alice has 1300
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '4');

      await token.mint(1000, { from:alice });  // alice has 2300
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '4');

      await token.burn(2100, { from:alice });   // alice  has 200
      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '2');
    });

    it('massUpdateMemberships() should update membership levels after setMembershipRequirement()', async () => {
      const { rara, token } = this;
      await rara.approve(token.address, 50000, { from:alice });
      await rara.approve(token.address, 50000, { from:bob });
      await rara.approve(token.address, 50000, { from:carol });
      await rara.approve(token.address, 50000, { from:dave });

      await token.mint(75, { from:alice });
      await token.mint(200, { from:bob });
      await token.mint(500, { from:carol });
      await token.mint(2000, { from:dave });

      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '1');
      assert.equal((await token.getCurrentLevel(carol)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(dave)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(edith)).valueOf(), '0');

      await token.setMembershipRequirement([0, 0, 100, 300, 1000], { from:manager });
      await token.massUpdateMemberships([alice, bob, carol, dave, edith]);

      assert.equal((await token.getCurrentLevel(alice)).valueOf(), '1');
      assert.equal((await token.getCurrentLevel(bob)).valueOf(), '2');
      assert.equal((await token.getCurrentLevel(carol)).valueOf(), '3');
      assert.equal((await token.getCurrentLevel(dave)).valueOf(), '4');
      assert.equal((await token.getCurrentLevel(edith)).valueOf(), '1');
    });

    it('should fail if you try to do transfers', async () => {
      const { rara, token } = this;
      rara.approve(token.address, 100, { from:alice });
      rara.approve(token.address, 200, { from:bob });

      await token.mint(100, { from:alice });
      await token.mint(150, { from:bob });

      await token.approve(carol, 150, { from:bob });

      expectRevert(token.transfer(bob, 100, { from:alice }), "vRARA: transfer between nonzero addresses");
      expectRevert(token.transferFrom(bob, edith, 100, { from:carol }), "vRARA: transfer between nonzero addresses");
    });
  });
