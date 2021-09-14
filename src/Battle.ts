import { Message, MessageEmbed } from "discord.js";
import { Player } from "./Player";
import { GOLD, random, RED, sleep } from "./utils";

export class Battle {
  private round = 0;
  private msg: Message;
  private players: Player[];

  constructor(msg: Message, players: Player[]) {
    this.msg = msg;
    this.players = [...new Set(players)];
  }

  private bar(progress: number, maxProgress: number) {
    if (progress < 0) progress = 0;

    const maxFill = 20;
    const fill = "█";
    const path = " ";
    const fillProgress = Math.round((progress * maxFill) / maxProgress);

    return Array(maxFill)
      .fill(fill)
      .map((v, i) => (fillProgress > i ? v : path))
      .join("");
  }

  /** adds progress bar to battleEmbed */ 
  private progressBar(
    embed: MessageEmbed, name: string, hp: number, maxHP: number,
  ) {

    const maxHPStr = Math.round(maxHP);
    const healthBar = this.bar(hp, maxHP);
    const remainingHP = hp >= 0 ? Math.round(hp) : 0;

    embed.addField(
      `${name}'s remaining HP`,
      `\`${healthBar}\` \`${remainingHP}/${maxHPStr}\``
    );
  }

  private attack(p1: Player, p2: Player) {
    const isCrit = p1.isCrit();
    const attackRate = isCrit ? p1.attack * p1.critDamage : p1.attack;
    const armorProtection = p2.armor * attackRate;
    const damageDealt = attackRate - armorProtection;
    const critText = isCrit ? ` (x${p1.critDamage})` : "";

    p2.hp -= damageDealt;

    const battleEmbed = new MessageEmbed()
      .setColor(RED)
      .setThumbnail(p1.imageUrl)
      .addField("Attacking Player", p1.name, true)
      .addField("Defending Player", p2.name, true)
      .addField("Round", `\`${this.round.toString()}\``, true)
      .addField("Attack Rate", `\`${Math.round(attackRate)}${critText}\``, true)
      .addField("Damage Reduction", `\`${Math.round(armorProtection)}\``, true)
      .addField("Damage Done", `\`${Math.round(damageDealt)}\``, true);

    return battleEmbed;
  }

  async run() {

    if (this.players.length <= 1)
      throw new Error("cannot battle with 1 or less player");

    let battleQueue = this.players.map(x => x.copy());
    const message = await this.msg.channel.send("Starting battle");

    while (battleQueue.length !== 1) {
      this.round++;

      const player = battleQueue.shift()!;
      const opponent = random().pick(battleQueue);

      if (player.pet && player.pet.isIntercept()) {
        const petEmbed = player.pet.intercept(opponent);
        await message.edit({ embeds: [petEmbed] });
        await sleep(4000);
      }

      const battleEmbed = this.attack(player, opponent);

      for (const p1 of this.players) {
        const currHealth = [player, ...battleQueue].find(x => x.id === p1.id)?.hp;
        if (currHealth !== undefined) {
          this.progressBar(battleEmbed, p1.name, currHealth, p1.hp);
        }
      }

      await message.edit({ embeds: [battleEmbed] });

      battleQueue.push(player);

      if (opponent.hp <= 0) {
        battleQueue = battleQueue.filter(x => x.id !== opponent.id);
        await this.msg.channel.send(`${opponent.name} has died in the battle`);
      } 

      // wait before next round
      if (battleQueue.length !== 1)
        await sleep(4000);
    }

    const winner = battleQueue[0];
    const winEmbed = new MessageEmbed()
      .setColor(GOLD)
      .setTitle("Battle Winner")
      .setThumbnail(winner.imageUrl)
      .setDescription(`${winner.name} has won the battle!`)

    await message.edit({ embeds: [winEmbed] });
  }
}
