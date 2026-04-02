import Map "mo:core/Map";
import Queue "mo:core/Queue";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Random "mo:core/Random";


/// Stores delegation chains for CLI-based Internet Identity login.
///
/// The CLI registers a session (UUID + public key) and receives a short code.
/// The user enters the code in the browser frontend, which triggers II login
/// and stores the resulting delegation chain. The CLI then retrieves it by UUID.
///
/// All registrations and delegations expire after 5 minutes.
persistent actor {

  /// A single signed delegation within a chain.
  type SignedDelegation = {
    signature : Text;
    delegation : {
      pubkey : Text;
      expiration : Text;
      targets : ?[Text];
    };
  };

  /// A complete delegation chain: root public key + ordered list of signed delegations.
  type DelegationChain = {
    publicKey : Text;
    delegations : [SignedDelegation];
  };

  /// A delegation chain with its storage timestamp for expiration tracking.
  type StoredDelegation = {
    chain : DelegationChain;
    storedAt : Int;
  };

  /// A pending CLI registration: maps a short code to a UUID and public key.
  type Registration = {
    uuid : Text;
    publicKey : Text;
    registeredAt : Int;
  };

  type RegisterResult = {
    #ok : Text;
    #err : Text;
  };

  type TimeEntry = (Int, Text); // (storedAt, key)

  // Delegation storage
  let store : Map.Map<Text, StoredDelegation> = Map.empty();
  let timeline : Queue.Queue<TimeEntry> = Queue.empty();

  // Registration storage
  let registrations : Map.Map<Text, Registration> = Map.empty();
  let registrationTimeline : Queue.Queue<TimeEntry> = Queue.empty();

  transient let maxUuidLength : Nat = 36;
  transient let maxPublicKeyLength : Nat = 1000;
  transient let fiveMinutesNs : Int = 5 * 60 * 1_000_000_000;
  transient let codeLength : Nat = 6;

  // A-Z (excluding O) + 2-9 (excluding 0,1) = 25 + 8 = 33 chars
  // Actually: A-Z minus O and I = 24 letters, plus 2-9 = 8 digits = 32 chars
  transient let charset : [Char] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K',
    'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
    'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7',
    '8', '9'
  ];

  transient let random = Random.crypto();

  /// Removes stored delegations older than `cutoff` from the front of the timeline.
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

  /// Removes registrations older than `cutoff` from the front of the timeline.
  func cleanupExpiredRegistrations(cutoff : Int) {
    loop {
      switch (Queue.peekFront(registrationTimeline)) {
        case (?(registeredAt, code)) {
          if (registeredAt < cutoff) {
            ignore Queue.popFront(registrationTimeline);
            Map.remove(registrations, Text.compare, code);
          } else {
            return;
          };
        };
        case null { return };
      };
    };
  };

  /// Generates a random 6-character code from the ambiguity-free charset.
  func generateCode() : async* Text {
    var code = "";
    for (_ in Nat.range(0, codeLength)) {
      let idx = await* random.natRange(0, charset.size());
      code := code # Text.fromChar(charset[idx]);
    };
    code;
  };

  /// Registers a CLI session. Stores the UUID and public key, returns a short
  /// code for the user to enter in the browser frontend.
  /// Cleans up expired registrations before creating a new one.
  public func register(uuid : Text, publicKey : Text) : async RegisterResult {
    if (uuid.size() == 0 or uuid.size() > maxUuidLength) {
      return #err("Invalid UUID length");
    };
    if (publicKey.size() == 0 or publicKey.size() > maxPublicKeyLength) {
      return #err("Invalid public key length");
    };

    let now = Time.now();
    cleanupExpiredRegistrations(now - fiveMinutesNs);

    // Generate a unique short code
    var code = await* generateCode();
    while (Map.containsKey(registrations, Text.compare, code)) {
      code := await* generateCode();
    };

    Map.add(registrations, Text.compare, code, {
      uuid;
      publicKey;
      registeredAt = now;
    });
    Queue.pushBack(registrationTimeline, (now, code));

    #ok(code);
  };

  /// Looks up a registration code and returns the associated public key,
  /// or null if the code is invalid or expired.
  public query func lookup_code(code : Text) : async ?Text {
    if (code.size() != codeLength) return null;
    switch (Map.get(registrations, Text.compare, code)) {
      case (?reg) {
        if (Time.now() - reg.registeredAt <= fiveMinutesNs) {
          ?reg.publicKey;
        } else {
          null;
        };
      };
      case null { null };
    };
  };

  /// Stores a delegation chain for the given registration code.
  /// Requires an authenticated (non-anonymous) caller and a valid, non-expired registration.
  /// Cleans up expired delegations before storing.
  public shared(msg) func store_delegation(code : Text, chain : DelegationChain) : async () {
    assert not Principal.isAnonymous(msg.caller);
    assert code.size() == codeLength;
    switch (Map.get(registrations, Text.compare, code)) {
      case (?reg) {
        assert Time.now() - reg.registeredAt <= fiveMinutesNs;
        let now = Time.now();
        cleanupExpired(now - fiveMinutesNs);
        Map.add(store, Text.compare, reg.uuid, { chain; storedAt = now });
        Queue.pushBack(timeline, (now, reg.uuid));
      };
      case null {
        assert false;
      };
    };
  };

  /// Retrieves a stored delegation chain by UUID.
  /// Returns null if the UUID is not found or the delegation has expired.
  public query func get_delegation(uuid : Text) : async ?DelegationChain {
    if (uuid.size() > maxUuidLength) return null;
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
