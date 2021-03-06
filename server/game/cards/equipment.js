'use strict';

var Card = aReq('server/game/cards/card'),
    misc = aReq('server/misc');

function Equipment(name, suit, rank, slot) {
    Card.call(this, name, suit, rank);
    this.slot = slot;
}
misc.extend(Card, Equipment, {
    format: function() {
        var formatted = misc.merge(Card.prototype.format.apply(this, arguments), {
            slot: this.slot
        });
        for (var key in this) {
            if (!key.endsWith('Modifier')) continue;
            formatted[key] = this[key];
        }
        return formatted;
    },
    handlePlay: function(step, onResolved) {
        let onTarget = target => {
            step.player.hand.remove(this.id);
            var current = target.equipped.find(c => c.slot === this.slot);
            if (current) target.equipped.discard(current.id);
            target.equipped.push(this);
            step.game.onGameEvent({
                name: 'equipped',
                player: step.player.name,
                target: target.name,
                card: this.format()
            });
            this.handleAfterPlay(step, onResolved, target);
        };
        let getTarget = this.getTarget(
            step.player,
            step.game.players,
            onTarget,
            // onCancel
            () => onResolved()
        );
        if (getTarget) onResolved(getTarget);
        else onTarget(step.player);
    },
    handleAfterPlay: function(step, onResolved, target) {
        onResolved();
    },
    getTarget: () => null
});

module.exports = Equipment;