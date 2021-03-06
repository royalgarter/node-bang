'use strict';

var misc = aReq('server/misc'),
    log = aReq('server/log'),
    warn = aReq('server/warn'),

    stats = aReq('server/game/stats'),
    roles = aReq('server/game/roles'),

    Phase = aReq('server/game/phase'),
    CardPile = aReq('server/game/card-pile'),
    Equipped = aReq('server/game/equipped'),
    Hand = aReq('server/game/hand'),
    Turn = aReq('server/game/turn'),
    End = aReq('server/game/end');

module.exports = new Phase('Playing', {

    goToNextTurn: function(game) {
        this.turn = this.getNextTurn(game);
    },

    getNextTurn: function(game) {
        if (!this.turn)
            return new Turn(game, game.players.find(p => p.role === roles.sheriff));
        let indexOfCurrent = game.players.indexOf(this.turn.player);
        for (let i = 1; i < game.players.length; i++) {
            let player = game.players[(indexOfCurrent + i) % game.players.length];
            if (player.alive) return new Turn(game, player);
        }
        return null;
    },

    begin: function(game) {
        this.cards = new CardPile(game, aReq('server/game/cards').slice());
        game.players.forEach(p => this.extendPlayer(game, p));
        this.goToNextTurn(game);
    },

    extendPlayer: function(game, player) {
        var phase = this;

        // Equipped first: it's needed for stat calculations
        player.equipped = new Equipped(game, player, this.cards);

        // Distance second: it's needed for the remainder of the player values
        misc.merge(player, {
            modifier: function(name) {
                var modifier = name + 'Modifier';
                return (this.character[modifier]|0)
                    + (this.role[modifier]|0)
                    + (this.equipped.stat(modifier)|0);
            },
            stat: function(name) {
                if (stats[name] === undefined)
                    throw 'Stat ' + name + ' does not exist';
                return stats[name] + this.modifier(name);
            },

            distanceTo: function(players, to) {
                var dist = Math.abs(players.indexOf(this) - players.indexOf(to));
                dist = Math.min(dist, players.length - dist);
                return dist + to.stat('distance');
            },

            stats: function() {
                return Object.keys(stats).reduce((obj, stat) => {
                    obj[stat] = this.stat(stat);
                    return obj;
                }, {});
            },

            handlers: function(eventName) {
                var handlers = [];
                if (this.character[eventName]) handlers.push(this.character);
                if (this.role[eventName]) handlers.push(this.role);
                this.equipped.forEach(e => e[eventName] && handlers.push(e));
                handlers.sort((handlers, i) => handlers.priority|0);
                return handlers;
            }
        });

        // Life third: it's used in the hand limit calculations
        misc.merge(player, {
            life: player.stat('life'),
            alive: true,
            heal: function(amount) {
                this.life = Math.min(this.life + amount, this.stat('life'));
            },
            get dead() { return !this.alive; },
            set dead(val) { this.alive = !val; },
            get dying() { return this.life <= 0 },
            get zombie() { return this.alive && this.disconnected; }
        });

        player.hand = new Hand(game, player, this.cards);
    },

    update: function(game, delta) {
        return this.turn && this.turn.update(delta);
    },

    end: function(game) {
        game.players.forEach(p => {
            delete p.equipped;

            delete p.modifier;
            delete p.stat;
            delete p.distanceTo;
            delete p.stats;
            delete p.handlers;

            delete p.life;
            delete p.alive;
            delete p.heal;
            delete p.dead;
            delete p.dying;
            delete p.zombie;

            delete p.hand;
        });
    },

    actionsFor: function(game, player) {
        if (!player || !this.turn) return {};
        return this.turn.actionsFor(player);
    },

    handleAction: function(game, player, msg) {
        if (!player || !this.turn) return false;
        return this.turn.handleAction(player, msg);
    },

    handleDisconnect: function(game, player) {
        log(player.name, 'is now a zombie!');
        this.turn.handleDisconnect(player);
    },

    format: function(game, player, formatted) {
        return misc.merge(formatted, {
            turn: this.turn.format(player),
            cards: {
                pile: this.cards.length,
                discard: this.cards.discarded.map(card => card.format())
            }
        });
    },

    formatPlayer: function(game, player, other, formatted) {
        return misc.merge(formatted, {
            hand: {
                cards: player === other ?
                    other.hand.map(card => card.format()) :
                    other.hand.length
            },
            equipped: other.equipped.map(card => card.format()),
            life: other.life,
            stats: other.stats(),
            distance: player ? player.distanceTo(game.players, other) : undefined
        });
    },

    checkForEnd: function(game) {
        var alive = game.players.filter(p => p.alive);
        var aliveCount = {};
        Object.keys(roles).forEach(key => aliveCount[key] = 0);
        alive.forEach(p => aliveCount[p.role.key]++);
        game.players.forEach(p => p.winner = false);
        // If the sheriff is dead, then either a renegade or the outlaws have won
        if (!aliveCount.sheriff) {
            // If there is one alive and it's a renegade; they have won
            if (alive.length === 1 && alive[0].role === roles.renegade) {
                game.players.forEach(p => p.winner = p.alive);
                game.switchToPhase(End);
                return true;
            }
            // Otherwise, outlaws have won
            else {
                game.players.forEach(p => p.winner = (p.role === roles.outlaw));
                game.switchToPhase(End);
                return true;
            }
        }
        // If no outlaws and no renegades have won,
        // then the sheriff and deputies have won
        else if (!(aliveCount.outlaw + aliveCount.renegade)) {
            game.players.forEach(p => p.winner =
                (p.role === roles.sheriff || p.role === roles.deputy));
            game.switchToPhase(End);
            return true;
        }
        return false;
    }
});