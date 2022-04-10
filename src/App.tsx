import * as React from 'react';
import styled from 'styled-components';

import Web3Modal from 'web3modal';
// @ts-ignore
import WalletConnectProvider from '@walletconnect/web3-provider';
import Column from './components/Column';
// import Wrapper from './components/Wrapper';
// import Header from './components/Header';
import Loader from './components/Loader';
import Button from './components/Button';
import ConnectButton from './components/ConnectButton';

import { Web3Provider } from '@ethersproject/providers';
import { getChainData } from './helpers/utilities';

import {
  MARKETPLACE_ADDRESS
} from './constants/constants.js';
import {
  TEST_COLLECTION_ADDRESS
} from './constants/constants.js';
import { getContract } from './helpers/ethers';
import MARKETPLACE from './abis/Marketplace.json';
import ERC721 from './abis/ERC721.json';
import TestNFT from './abis/TestNFT.json';

import './styles.css';

import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";
import { formatEther, parseUnits } from 'ethers/lib/utils';
import Wrapper from './components/Wrapper';
import Header from './components/Header';
import { logMsg } from './helpers/dev';
// import { ethers } from 'hardhat';

// const SLayout = styled.div`
//   position: relative;
//   width: 100%;
//   min-height: 100vh;
//   text-align: center;
// `;

// const SContent = styled(Wrapper)`
//   width: 100%;
//   height: 100%;
//   padding: 0 16px;
// `;


const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

const SLanding = styled(Column)`
  height: 600px;
`;

// @ts-ignore
const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

interface Item {
  itemId: number
  price: string
  tokenId: number
  owner: string
  forSale: Boolean
  collectionAddress: string
  imgURL: string
}

interface Collection {
  name: string,
  address: string
}

interface Offer {
  buyer: string,
  price: string
}

interface IAppState {
  loading: boolean;
  fetching: boolean;
  address: string;
  library: any;
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  network: string;
  result: any | null;
  marketplaceContract: any | null;
  info: any | null;
  collections: Collection[];
  mintTokenURIInputValue: string;
  createCollectionInputValue: string;
  selectedCollection: string;
  items: Item[];
  addItemCollectionInputValue: string;
  addItemTokenIdInputValue: string;
  listItemInputValues: string[];
  sendOfferInputValues: string[];
  selectedUser: string;
  offers: Offer[][];
  mintedTokenId: number | null;
}

const INITIAL_STATE: IAppState = {
  loading: false,
  fetching: false,
  address: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  network: "",
  result: null,
  marketplaceContract: null,
  info: null,
  collections: [],
  mintTokenURIInputValue: "",
  createCollectionInputValue: "",
  selectedCollection: "",
  items: [],
  addItemCollectionInputValue: "",
  addItemTokenIdInputValue: "",
  listItemInputValues: [],
  sendOfferInputValues: [],
  selectedUser: "",
  offers: [],
  mintedTokenId: null,
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions()
    });
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
  }

  public onConnect = async () => {
    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const network = await library.getNetwork();
    const networkName = network.name;
    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider.accounts[0];

    const marketplaceContract = getContract(MARKETPLACE_ADDRESS, MARKETPLACE.abi, library, address);

    this.setState({
      library,
      chainId: network.chainId,
      address,
      connected: true,
      marketplaceContract,
      network: networkName
    });

    await this.getCollections();
    await this.getAllItems();

    await this.subscribeToProviderEvents(this.provider);
  };

  public subscribeToProviderEvents = async (provider: any) => {
    if (!provider.on) {
      return;
    }

    const { marketplaceContract } = this.state;

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);
    marketplaceContract.on("CollectionAdded", () => {
      this.getCollections();
    });
    marketplaceContract.on("ItemAdded", () => {
      this.getAllItems();
    });
    marketplaceContract.on("ItemListed", () => {
      this.getAllItems();
    });
    marketplaceContract.on("ItemSold", () => {
      this.getAllItems();
    });
    marketplaceContract.on("OfferSent", () => {
      this.getAllItems();
    });

    await this.web3Modal.off('accountsChanged');
  };

  public async unSubscribe(provider: any) {
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload();
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);
  }

  public changedAccount = async (accounts: string[]) => {
    if (!accounts.length) {
      // Metamask Lock fire an empty accounts array 
      await this.resetApp();
    } else {
      const { library } = this.state;
      const address = accounts[0];
      const marketplaceContract = getContract(MARKETPLACE_ADDRESS, MARKETPLACE.abi, library, address);
      this.setState({
        address,
        marketplaceContract
      });
    }
  }

  public networkChanged = async (_networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });
  }

  public close = async () => {
    this.resetApp();
  }

  public getNetwork = () => getChainData(this.state.chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID
        }
      }
    };
    return providerOptions;
  };

  public resetApp = async () => {
    await this.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(this.provider);

    this.setState({ ...INITIAL_STATE });
  };

  public addCollection = async () => {
    const { marketplaceContract, createCollectionInputValue } = this.state;
    try {
      this.setState ({ loading: true });
      const transaction = await marketplaceContract.addCollection(createCollectionInputValue);
      await transaction.wait();
      this.setState ({ loading: false });
    } catch (error) {
      if (error.error) {
        alert(error.error.message);
      } else {
        alert(error.message);
      }
      this.setState ({ loading: false });
    }
  }

  public sendOffer = async (itemId: number, idx: number) => {
    const { marketplaceContract, sendOfferInputValues } = this.state;
    try {
      this.setState ({ loading: true });
      const transaction = await marketplaceContract.sendOffer(itemId, { value: parseUnits(sendOfferInputValues[idx]) });
      await transaction.wait();
      this.setState ({ loading: false });
    } catch (error) {
      alert(error.message);
      this.setState ({ loading: false });
    }
  }

  public buyItem = async (itemId: number) => {
    const { marketplaceContract } = this.state;
    const itemPrice = this.state.items.find(item => item.itemId === itemId)!.price;
    try {
      this.setState ({ loading: true });
      const transaction = await marketplaceContract.buyItem(itemId, { value: parseUnits(itemPrice) });
      await transaction.wait();
      this.setState ({ loading: false });
    } catch (error) {
      alert(error.message);
      this.setState ({ loading: false });
    }
  }

  public listItem = async (itemId: number, idx: number) => {
    const { library, address, marketplaceContract, listItemInputValues, items } = this.state;
    const item = items.find(item => item.itemId === itemId)!
    const collectionContract = getContract(item.collectionAddress, ERC721.abi, library, address);
    try {
      this.setState ({ loading: true });
      const approvedAddress = await collectionContract.getApproved(itemId);
      if (approvedAddress.toLocaleLowerCase() !== MARKETPLACE_ADDRESS.toLocaleLowerCase()) {
        const approveTransaction = await collectionContract.approve(MARKETPLACE_ADDRESS, item.tokenId);
        const approveReceipt = await approveTransaction.wait();
        this.setState ({ loading: false });
        if (approveReceipt.status != 1) return;
      }
      this.setState ({ loading: true });
      const listItemTransaction = await marketplaceContract.listItem(itemId, parseUnits(listItemInputValues[idx]));
      await listItemTransaction.wait();
      this.setState ({ loading: false });
    } catch (error) {
      alert(error.message);
      this.setState ({ loading: false });
    }
  }

  public acceptOffer = async (itemId: number, offerId: number) => {
    const { library, address, marketplaceContract, items } = this.state;
    const item = items.find(item => item.itemId === itemId)!
    const collectionContract = getContract(item.collectionAddress, ERC721.abi, library, address)
    try {
      this.setState ({ loading: true });
      const approvedAddress = await collectionContract.getApproved(itemId);
      if (approvedAddress.toLocaleLowerCase() !== MARKETPLACE_ADDRESS.toLocaleLowerCase()) {
        const approveTransaction = await collectionContract.approve(MARKETPLACE_ADDRESS, item.tokenId);
        const approveReceipt = await approveTransaction.wait();
        this.setState ({ loading: false });
        if (approveReceipt.status != 1) return;
      }
      this.setState ({ loading: true });
      const buyer = await marketplaceContract.itemIdToOfferIdToBuyer(itemId, offerId);
      const price = await marketplaceContract.itemIdToBuyerToPrice(itemId, buyer);
      const acceptOfferTransaction = await marketplaceContract.acceptOffer(itemId, offerId, { value: price });
      await acceptOfferTransaction.wait();
      this.setState ({ loading: false });
    } catch (error) {
      alert(error.message);
      this.setState ({ loading: false });
    }
  }

  public addItem = async () => {
    const { marketplaceContract, addItemCollectionInputValue, addItemTokenIdInputValue } = this.state;
    try {
      this.setState ({ loading: true });
      const transaction = await marketplaceContract.addItem(addItemCollectionInputValue, +addItemTokenIdInputValue);
      await transaction.wait();
      this.setState ({ loading: false });
    } catch (error) {
      alert(error.message);
      this.setState ({ loading: false });
    }
  }

  public getCollections = async () => {
    const { address, library, marketplaceContract } = this.state;
    const collectionCount = await marketplaceContract.collectionCount();
    logMsg(123, collectionCount)
    const collections: Collection[] = []
    for (let index = 1; index <= collectionCount; index++) {
      const collectionAddress = await marketplaceContract.idToCollection(index);
      const collectionContract = getContract(collectionAddress, ERC721.abi, library, address);
      const name = await collectionContract.name();
      const collection = {
        name,
        address: collectionAddress
      }
      collections.push(collection);
    }
    this.setState({ collections });
  }

  public getOffers = async () => {
    const { address, items, marketplaceContract } = this.state;
    const filteredItems = items.filter((item) => {
      return item.owner.toLocaleLowerCase() === address.toLocaleLowerCase();
    })

    const offers: Offer[][] = []
    for (let itemIdx = 0; itemIdx < filteredItems.length; itemIdx++) {
      const itemId = filteredItems[itemIdx].itemId;
      const offerCount = await marketplaceContract.itemIdToOfferCount(itemId);
      offers[itemIdx] = []

      for (let offerId = 1; offerId <= offerCount; offerId++) {
        const buyer = await marketplaceContract.itemIdToOfferIdToBuyer(itemId, offerId);
        const price = await marketplaceContract.itemIdToBuyerToPrice(itemId, buyer);
        const offer = {
          buyer,
          price: formatEther(price)
        };
        offers[itemIdx].push(offer);
      }
    }

    this.setState({ offers });
  }

  public getAllItems = async () => {
    const { address, library, marketplaceContract } = this.state;

    const itemCount = await marketplaceContract.itemCount();
    const itemsCntNumber = itemCount.toNumber()
    const items: Item[] = []
    for (let i = 1; i <= itemsCntNumber; i++) {
      const item = await marketplaceContract.idToItem(i);
      const collectionContract = getContract(item.contractAddress, ERC721.abi, library, address)
      const imgURL = await collectionContract.tokenURI(item.tokenId);

      const listing: Item = {
        itemId: i,
        price: formatEther(item.price),
        tokenId: item.tokenId.toString(),
        owner: item.owner,
        forSale: item.forSale,
        collectionAddress: item.contractAddress,
        imgURL
      }
      items.push(listing);
    }
    this.setState({ items });
  }

  public mintNFT = async () => {
    const { address, library, mintTokenURIInputValue } = this.state;
    const testNFTContract = getContract(TEST_COLLECTION_ADDRESS, TestNFT.abi, library, address);
    this.setState ({ loading: true });
    const transaction = await testNFTContract.mint(`${mintTokenURIInputValue}`);
    const receipt = await transaction.wait();
    this.setState ({ loading: false });
    if (receipt.status != 1) return;
    const mintedTokenId = await testNFTContract.tokenCount();
    this.setState({ mintedTokenId });
  }

  public mintTokenURIInputChange = async (event: any) => {
    const newValue = event.target.value;
    this.setState({ mintTokenURIInputValue: newValue })
  }

  public addItemTokenIdInputChange = async (event: any) => {
    const newValue = event.target.value;
    this.setState({ addItemTokenIdInputValue: newValue })
  }

  public addItemCollectionInputChange = async (event: any) => {
    const newValue = event.target.value;
    this.setState({ addItemCollectionInputValue: newValue })
  }

  public sendOfferInputChange = async (event: any, idx: number) => {
    const newValue = event.target.value;
    const { sendOfferInputValues } = this.state;
    sendOfferInputValues[idx] = newValue;
    this.setState({ sendOfferInputValues })
  }

  public createCollectionInputChange = async (event: any) => {
    const newValue = event.target.value;
    this.setState({ createCollectionInputValue: newValue })
  }

  public listItemInputChange = async (event: any, idx: number) => {
    const newValue = event.target.value;
    const { listItemInputValues } = this.state;
    listItemInputValues[idx] = newValue
    this.setState({ listItemInputValues });
  }

  public getMyItemsComponent = () => {
    const { items, address, offers, mintedTokenId, network } = this.state;

    return (
      <Wrapper>
        <h2>My Items</h2>
        <div>
          {network === "rinkeby" ?
            <div>
              <p>Minting only works for TestNFT Collection ({TEST_COLLECTION_ADDRESS})</p>
              <input type='text' onChange={this.mintTokenURIInputChange} value={this.state.mintTokenURIInputValue} placeholder="URI"></input>
              <Button onClick={this.mintNFT}>Mint nft</Button>
              {mintedTokenId != null ? `You've just minted NFT with id '${mintedTokenId}'` : ""}
            </div> : <br></br>}

          <br></br>
          <br></br>

          <input type='text' onChange={this.addItemCollectionInputChange} value={this.state.addItemCollectionInputValue} placeholder="collection address"></input>
          <input type='text' onChange={this.addItemTokenIdInputChange} value={this.state.addItemTokenIdInputValue} placeholder="token id"></input>
          <Button onClick={this.addItem}>Add item</Button>
        </div>

        <br></br>
        <br></br>
        <br></br>

        {items.filter((item) => {
          return item.owner.toLocaleLowerCase() === address.toLocaleLowerCase()
        }).map((item, idx) => {
          return (
            <div key={idx}>
              <img style={{maxWidth: "500px", maxHeight: "500px"}} src={`${item.imgURL}`} />
              <div>
                <p>Collection address: {item.collectionAddress}</p>
                <p>Token id: {item.tokenId}</p>
                {item.forSale ?
                  <p>Item price: {item.price} ETH</p> :
                  <div>
                    <input type='text' onChange={(event) => this.listItemInputChange(event, idx)} value={this.state.listItemInputValues[idx]} placeholder='Item price'></input>
                    <Button onClick={() => this.listItem(item.itemId, idx)}>List item</Button>
                  </div>}
              </div>
              <br></br>
              {offers[idx] != undefined && offers[idx].length > 0 ?
                <div>
                  <h5>Offers:</h5>
                  {
                    offers[idx].map((offer, offerId) => {
                      return (
                        <div key={offerId}>
                          <p>   Buyer: {offer.buyer}</p>
                          <p>   Price: {offer.price} ETH</p>
                          <Button onClick={() => this.acceptOffer(item.itemId, offerId + 1)}>Accept offer</Button>
                          <br></br>
                          <br></br>
                          <br></br>
                        </div>
                      )
                    })
                  }
                </div> : <div></div>
              }
            </div>
          )
        })}
      </Wrapper>
    )
  }

  public getUserItemsComponent = () => {
    const { items, selectedUser } = this.state;

    return (
      <Wrapper>
        <h4> User: {selectedUser} </h4>
        <br></br>
        <br></br>
        <br></br>

        {items.filter((item) => {
          return item.owner.toLocaleLowerCase() === selectedUser.toLocaleLowerCase()
        }).map((item, idx) => {
          return (
            <div key={idx}>
               <img style={{maxWidth: "500px", maxHeight: "500px"}} src={`${item.imgURL}`} />
              <div>
                <p>Collection address: {item.collectionAddress}</p>
                <p>Token id: {item.tokenId}</p>
                {item.forSale ?
                  <div>
                    <p>Item price: {item.price} ETH</p>
                    <Button onClick={() => this.buyItem(item.itemId)}>Buy item</Button>
                  </div> :
                  <div></div>}
                <div>
                  <input type='text' onChange={(event) => this.sendOfferInputChange(event, idx)} value={this.state.sendOfferInputValues[idx]} placeholder="price"></input>
                  <Button onClick={() => this.sendOffer(item.itemId, idx)}>Send offer</Button>
                </div>
              </div>
              <br></br>
            </div>
          )
        })}
      </Wrapper>
    )
  }

  public getCollectionItemsComponent = () => {
    const { items, selectedCollection } = this.state;

    return (
      <Wrapper>
        <div>
          <h2>Items</h2>
          <br></br>
          <br></br>
          <br></br>
        </div>

        {items.filter((item) => {
          return item.forSale && item.collectionAddress.toLocaleLowerCase() === selectedCollection.toLocaleLowerCase()
        }).map((item, idx) => {
          return (<div key={idx}>
             <img style={{maxWidth: "500px", maxHeight: "500px"}} src={`${item.imgURL}`} />
            <div>
              <p>Collection address: {item.collectionAddress}</p>
              <p>Token id: {item.tokenId}</p>
              <p>Item price: {item.price} ETH</p>
              <Link to="/user" onClick={() => this.setState({ selectedUser: item.owner })}>Owner: {item.owner}</Link>
            </div>
            <br></br>
            {this.state.address.toLowerCase() === item.owner.toLowerCase() ?
              <div></div> :
              <div>
                <div>
                  <Button onClick={() => this.buyItem(item.itemId)}>Buy item</Button>
                </div>
                <div>
                  <input type='text' onChange={(event) => this.sendOfferInputChange(event, idx)} value={this.state.sendOfferInputValues[idx]} placeholder="price"></input>
                  <Button onClick={() => this.sendOffer(item.itemId, idx)}>Send offer</Button>
                </div>
              </div>
            }
            <br></br>
          </div>
          )
        })}
      </Wrapper>
    )
  }

  public getCollectionsComponent = () => {
    const {
      collections,
    } = this.state;
    return (
      <div>
        <h2>Collections</h2>
        <input type='text' onChange={this.createCollectionInputChange} value={this.state.createCollectionInputValue} placeholder="Collection address"></input>
        <Button onClick={this.addCollection}>Add collection</Button>
        <br></br>
        <br></br>
        <br></br>

        {collections.map((collection, idx) => {
          return (<div key={idx}>
            <Link to="/items" onClick={() => this.setState({ selectedCollection: collection.address })}>
              {`${collection.name} (${collection.address})`}
            </Link>
            <br></br>
            <br></br>
          </div>
          )
        })}
      </div>
    );
  }

  public render = () => {
    const {
      address,
      connected,
      chainId,
      fetching,
      loading
    } = this.state;

    return (
      <div> {!loading ?
        <div>
          <div>
            <Header
              connected={connected}
              address={address}
              chainId={chainId}
              killSession={this.resetApp}
            />
            <div>
              {fetching ? (
                <div>
                  <SContainer>
                    <Loader />
                  </SContainer>
                </div>
              ) : (
                <div>
                  {!this.state.connected && <ConnectButton onClick={this.onConnect} />}
                </div>
              )}
            </div>
          </div>

          {this.state.connected ?
            <Router>
              <div>
                <SContainer className="topnav">
                  <ul>
                    <li>
                      <Link to="/">Collections</Link>
                    </li>
                    <br></br>
                    <li>
                      <Link to="/MyItems" onClick={this.getOffers}>
                        My Items
                      </Link>
                    </li>
                  </ul>
                </SContainer>

                <SLanding center>
                  <Switch>
                    <Route exact path="/">
                      {this.getCollectionsComponent()}
                    </Route>
                    <Route path="/MyItems">
                      {this.getMyItemsComponent()}
                    </Route>
                    <Route path="/items">
                      {this.getCollectionItemsComponent()}
                    </Route>
                    <Route path="/user">
                      {this.state.selectedUser.toLocaleLowerCase() === this.state.address.toLocaleLowerCase() ?
                        this.getMyItemsComponent() :
                        this.getUserItemsComponent()}
                    </Route>
                    <></>
                  </Switch>
                </SLanding>


              </div>
            </Router> : <div></div>}
        </div> : <Wrapper><Loader /></Wrapper>
      }  </div>
    );
  };
}

export default App;
