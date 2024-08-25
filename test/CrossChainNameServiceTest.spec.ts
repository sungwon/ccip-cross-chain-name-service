import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";

describe("CrossChainNameService", function () {

  async function deploy() {
    // Create an instance of CCIPLocalSimulator.sol smart contract.
    const localSimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
    const localSimulator = await localSimulatorFactory.deploy();

    // Call the configuration() function to get Router contract address.
    const config: {
        chainSelector_: BigNumber;
        sourceRouter_: string;
        destinationRouter_: string;
        wrappedNative_: string;
        linkToken_: string;
        ccipBnM_: string;
        ccipLnM_: string;
    } = await localSimulator.configuration();

    // Create instances of CrossChainNameServiceRegister.sol, CrossChainNameServiceReceiver.sol and CrossChainNameServiceLookup.sol smart contracts and call the enableChain() function where needed.
    const CrossChainNameServiceLookupFactory = await ethers.getContractFactory("CrossChainNameServiceLookup");
    const CrossChainNameServiceLookupSource = await CrossChainNameServiceLookupFactory.deploy();
    const CrossChainNameServiceLookupReceiver = await CrossChainNameServiceLookupFactory.deploy();
    
    const CrossChainNameServiceRegisterFactory = await ethers.getContractFactory("CrossChainNameServiceRegister");
    const CrossChainNameServiceRegister = await CrossChainNameServiceRegisterFactory.deploy(
        config.sourceRouter_,
        CrossChainNameServiceLookupSource.address,
    );

    const CrossChainNameServiceReceiverFactory = await ethers.getContractFactory("CrossChainNameServiceReceiver");
    const CrossChainNameServiceReceiver = await CrossChainNameServiceReceiverFactory.deploy(
        config.destinationRouter_,
        CrossChainNameServiceLookupReceiver.address,
        config.chainSelector_
    );

    await CrossChainNameServiceRegister.enableChain(config.chainSelector_, CrossChainNameServiceReceiver.address, 200_000);

    // Call the setCrossChainNameServiceAddress function of the CrossChainNameServiceLookup.sol smart contract "source" instance and provide the address of the CrossChainNameServiceRegister.sol smart contract instance. Repeat the process for the CrossChainNameServiceLookup.sol smart contract "receiver" instance and provide the address of the CrossChainNameServiceReceiver.sol smart contract instance. 
    await CrossChainNameServiceLookupSource.setCrossChainNameServiceAddress(CrossChainNameServiceRegister.address);
    await CrossChainNameServiceLookupReceiver.setCrossChainNameServiceAddress(CrossChainNameServiceReceiver.address);


    return { localSimulator, CrossChainNameServiceRegister, CrossChainNameServiceReceiver, CrossChainNameServiceLookupSource, CrossChainNameServiceLookupReceiver };
  }

  it("Should register and lookup a name", async function () {
    const { localSimulator, CrossChainNameServiceRegister, CrossChainNameServiceReceiver, CrossChainNameServiceLookupSource, CrossChainNameServiceLookupReceiver } = await loadFixture(deploy);

    const [alice] = await ethers.getSigners();

    // Call the register() function and provide "alice.ccns" as the argument
    await CrossChainNameServiceRegister.register("alice.ccns", { from: alice.address });
  

    // Call the lookup() function and provide "alice.ccns" as a function argument. Assert that the returned address is Alice's EOA address.
    const result = await CrossChainNameServiceLookupSource.lookup("alice.ccns");
    expect(result).to.equal(alice.address);
  });
});