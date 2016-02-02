var Card = aReq('server/game/cards/card'),
    misc = aReq('server/misc');

function Beer(suit, rank) {
    Card.call(this, 'beer', suit, rank, Card.types.brown);
}
misc.extend(Card, Beer, {
    handlePlay: function(step, onResolved) {
        step.player.hand.discard(this.id);
        step.player.heal(1);
        step.game.onGameEvent({
            name: 'Beer',
            player: step.player.name,
            card: this.id
        });
    }
});

function Saloon(suit, rank) {
    Card.call(this, 'saloon', suit, rank, Card.types.brown);
}
misc.extend(Card, Saloon, {
    handlePlay: function(step, onResolved) {
        step.player.hand.discard(this.id);
        step.game.players
            .filter(p => p.alive)
            .forEach(p => p.heal(1));
        step.game.onGameEvent({
            name: 'Saloon',
            player: step.player.name,
            card: this.id
        });
    }
});

module.exports = {
    Beer: Beer,
    Saloon: Saloon
};