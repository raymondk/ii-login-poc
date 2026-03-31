import Map "mo:core/Map";
import Queue "mo:core/Queue";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Int "mo:core/Int";

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

  type StoredDelegation = {
    chain : DelegationChain;
    storedAt : Int;
  };

  type TimeEntry = (Int, Text); // (storedAt, uuid)

  // Maintain the uuid to delegation mapping
  let store : Map.Map<Text, StoredDelegation> = Map.empty();

  // Maintain an ordered queue of uuids for cleanup
  let timeline : Queue.Queue<TimeEntry> = Queue.empty();

  transient let fiveMinutesNs : Int = 5 * 60 * 1_000_000_000;

  func cleanupExpired(cutoff : Int) {
    loop {
      switch (Queue.peekFront(timeline)) {
        case (?(storedAt, uuid)) {
          if (storedAt < cutoff) {
            ignore Queue.popFront(timeline);
            Map.remove(store, Text.compare, uuid);
          } else {
            return;
          };
        };
        case null { return };
      };
    };
  };

  public func store_delegation(uuid : Text, chain : DelegationChain) : async () {
    let now = Time.now();
    cleanupExpired(now - fiveMinutesNs);
    Map.add(store, Text.compare, uuid, { chain; storedAt = now });
    Queue.pushBack(timeline, (now, uuid));
  };

  public query func get_delegation(uuid : Text) : async ?DelegationChain {
    switch (Map.get(store, Text.compare, uuid)) {
      case (?entry) {
        if (Time.now() - entry.storedAt <= fiveMinutesNs) {
          ?entry.chain;
        } else {
          null;
        };
      };
      case null { null };
    };
  };
};
