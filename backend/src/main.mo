import Map "mo:core/Map";
import Text "mo:core/Text";

persistent actor {

  type SignedDelegation = {
    signature : Text;
    delegation : {
      pubkey : Text;
      expiration : Text;
      targets : ?[Text];
    };
  };

  type DelegationChain = {
    publicKey : Text;
    delegations : [SignedDelegation];
  };

  let store : Map.Map<Text, DelegationChain> = Map.empty();

  public func store_delegation(uuid : Text, chain : DelegationChain) : async () {
    Map.add(store, Text.compare, uuid, chain);
  };

  public query func get_delegation(uuid : Text) : async ?DelegationChain {
    Map.get(store, Text.compare, uuid);
  };
};
